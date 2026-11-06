"""Folha de contato: monta quadros em grade com o tempo em cada um."""
import sys, glob
from PIL import Image, ImageDraw
import os; fs = sorted(glob.glob(os.environ.get('Q', 'quadros/q_*.png'))); out = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 7
w, h = 360, 640
rows = (len(fs) + cols - 1) // cols
s = Image.new('RGB', (cols * (w + 8), rows * (h + 36)), (40, 40, 40))
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((w, h)); x, y = (i % cols) * (w + 8), (i // cols) * (h + 36)
    s.paste(im, (x, y + 30)); ImageDraw.Draw(s).text((x + 4, y + 8), f.split('_')[1][:-4] + ' s', fill=(255, 255, 255))
s.save(out); print(s.size)
