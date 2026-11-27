"""Prints the RGB of one pixel of a PNG screenshot: pixel.py <png> <x> <y>.

Standard library only, so it runs on the CI runner with nothing installed.
Used by launch-check.sh to confirm the app really drew its dark or light page.
"""
import struct
import sys
import zlib


def pixel(path, x, y):
    with open(path, "rb") as f:
        data = f.read()
    pos, idat, width, height, ctype = 8, b"", 0, 0, 0
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, ctype = struct.unpack(">IIBB", chunk[:10])
            assert depth == 8, "only 8-bit PNGs"
        elif kind == b"IDAT":
            idat += chunk
        pos += 12 + length
    bpp = {2: 3, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    stride = width * bpp
    prev = bytearray(stride)
    for row in range(y + 1):
        start = row * (stride + 1)
        f, line = raw[start], bytearray(raw[start + 1:start + 1 + stride])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = line
    return tuple(prev[x * bpp:x * bpp + 3])


if __name__ == "__main__":
    r, g, b = pixel(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))
    print(f"{r} {g} {b}")
