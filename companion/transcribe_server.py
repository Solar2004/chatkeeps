#!/usr/bin/env python3
import argparse, base64, json, os, secrets, tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BODY=36_000_000
class Handler(BaseHTTPRequestHandler):
    server_version='ChatkeepsLocalTranscriber/1'
    def send_json(self,status,payload):
        body=json.dumps(payload,ensure_ascii=False).encode();self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
    def do_GET(self):
        if self.path=='/health':self.send_json(200,{'ok':True,'model':self.server.model_name})
        else:self.send_json(404,{'error':'No encontrado.'})
    def do_POST(self):
        if self.path!='/transcribe':return self.send_json(404,{'error':'No encontrado.'})
        if self.headers.get('Authorization') != 'Bearer '+self.server.token:return self.send_json(401,{'error':'Clave local incorrecta.'})
        try:n=int(self.headers.get('Content-Length','0'))
        except ValueError:n=0
        if n<2 or n>MAX_BODY:return self.send_json(413,{'error':'Petición vacía o demasiado grande.'})
        try:
            data=json.loads(self.rfile.read(n));raw=base64.b64decode(data['audio'],validate=True)
            if not raw or len(raw)>25*1024*1024:raise ValueError('Audio vacío o mayor de 25 MB.')
            suffix={"audio/ogg":'.ogg',"audio/opus":'.opus',"audio/mpeg":'.mp3',"audio/mp4":'.m4a',"audio/wav":'.wav'}.get(data.get('mime'),'.bin')
            with tempfile.NamedTemporaryFile(suffix=suffix,delete=False) as f:f.write(raw);name=f.name
            try:
                model=self.server.get_model();segments,info=model.transcribe(name,beam_size=5,vad_filter=True)
                text=' '.join(s.text.strip() for s in segments if s.text.strip()).strip()
                self.send_json(200,{'text':text,'language':info.language,'duration':info.duration})
            finally:Path(name).unlink(missing_ok=True)
        except Exception as e:self.send_json(400,{'error':str(e)[:500]})
    def log_message(self,fmt,*args):print('[local]',fmt%args)
class Server(ThreadingHTTPServer):
    def __init__(self,address,handler,token,model_name):super().__init__(address,handler);self.token=token;self.model_name=model_name;self._model=None
    def get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel
            print(f'Descargando/cargando modelo {self.model_name} si es necesario...')
            self._model=WhisperModel(self.model_name,device='cpu',compute_type='int8')
        return self._model
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',default='small');a=p.parse_args();token=secrets.token_urlsafe(32)
    print('CLAVE LOCAL:',token,flush=True);print('Escuchando SOLO en http://127.0.0.1:8766',flush=True)
    Server(('127.0.0.1',8766),Handler,token,a.model).serve_forever()
