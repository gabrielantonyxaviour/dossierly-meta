"""Makes two photo-like variants per clean letter (rotation, perspective, shadow, blur, noise, JPEG) and
transforms the truth box with the same homography. Run: python3 -I eval/data/make_photos.py"""
import json, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "images")
CW, CH = 1500, 2000  # canvas, long side 2000 like the app's client downscale


def solve_h(src, dst):
    """Homography mapping src quad -> dst quad (4 points each)."""
    A, b = [], []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    h = np.linalg.solve(np.array(A, float), np.array(b, float))
    return np.append(h, 1).reshape(3, 3)


def apply(H, pts):
    out = []
    for x, y in pts:
        p = H @ np.array([x, y, 1.0])
        out.append((p[0] / p[2], p[1] / p[2]))
    return out


def desk(rng):
    base = np.array([rng.randint(70, 150), rng.randint(60, 120), rng.randint(40, 100)], float)
    yy, xx = np.mgrid[0:CH, 0:CW]
    grad = 1 + 0.25 * (xx / CW - 0.5) * rng.choice([-1, 1]) + 0.2 * (yy / CH - 0.5)
    noise = np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 6, (CH, CW, 1))
    arr = base[None, None, :] * grad[..., None] + noise
    return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))


def variant(clean, box, seed, level):
    rng = random.Random(seed)
    W, H = clean.size
    ang = rng.uniform(3, 8) * rng.choice([-1, 1]) if level == 0 else rng.uniform(3, 6) * rng.choice([-1, 1])
    scale = rng.uniform(0.80, 0.92) if level == 0 else rng.uniform(0.72, 0.86)
    pw, ph = CW * scale, CW * scale * H / W
    cx, cy = CW / 2 + rng.uniform(-40, 40), CH / 2 + rng.uniform(-40, 40)
    pts = [(-pw / 2, -ph / 2), (pw / 2, -ph / 2), (pw / 2, ph / 2), (-pw / 2, ph / 2)]
    t = math.radians(ang)
    jit = (0.03 if level == 0 else 0.06) * pw
    dst = []
    for x, y in pts:
        xr, yr = x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t)
        dst.append((cx + xr + rng.uniform(-jit, jit), cy + yr + rng.uniform(-jit, jit)))
    src = [(0, 0), (W, 0), (W, H), (0, H)]
    Hm = solve_h(src, dst)
    inv = np.linalg.inv(Hm)
    coeffs = tuple((inv / inv[2, 2]).flatten()[:8])
    # shadow under the page
    canvas = desk(rng).convert("RGBA")
    sh = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(sh).polygon([(x + 18, y + 26) for x, y in dst], fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    canvas.paste(Image.new("RGBA", (CW, CH), (0, 0, 0, 255)), (0, 0), sh)
    warped = clean.convert("RGB").transform((CW, CH), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    mask = Image.new("L", (W, H), 255).transform((CW, CH), Image.PERSPECTIVE, coeffs, Image.BILINEAR)
    canvas.paste(warped.convert("RGBA"), (0, 0), mask)
    img = canvas.convert("RGB")
    # uneven lighting (a soft diagonal falloff) and a soft shadow cast across part of the page
    yy, xx = np.mgrid[0:CH, 0:CW]
    ux, uy = math.cos(rng.uniform(0, 6.28)), math.sin(rng.uniform(0, 6.28))
    light = 1 - (0.10 if level == 0 else 0.20) * ((xx * ux + yy * uy) / (CW + CH) + 0.5)
    arr = np.asarray(img, float) * light[..., None]
    arr += np.random.default_rng(seed).normal(0, 4 if level == 0 else 8, arr.shape)
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.5, 0.9) if level == 0 else rng.uniform(1.0, 1.6)))
    x1, y1, x2, y2 = box
    q = apply(Hm, [(x1, y1), (x2, y1), (x2, y2), (x1, y2)])
    nb = [round(min(p[0] for p in q)), round(min(p[1] for p in q)), round(max(p[0] for p in q)), round(max(p[1] for p in q))]
    return img, nb, round(ang, 1)


def main():
    labels = json.load(open(os.path.join(HERE, "labels.json")))
    for i, lab in enumerate(labels):
        lab["images"] = lab["images"][:1]
        clean = Image.open(os.path.join(IMG, lab["images"][0]["file"]))
        box = lab["images"][0]["box"]
        for level, name in enumerate(["photoA", "photoB"]):
            img, nb, ang = variant(clean, box, 1000 * i + level + 7, level)
            fn = f"{lab['id']}_{name}.jpg"
            img.save(os.path.join(IMG, fn), "JPEG", quality=82)
            lab["images"].append({"file": fn, "variant": name, "size": [CW, CH], "box": nb, "rotationDeg": ang})
    json.dump(labels, open(os.path.join(HERE, "labels.json"), "w"), indent=2, ensure_ascii=False)
    print(len(labels), "letters,", sum(len(l["images"]) for l in labels), "images")


main()
