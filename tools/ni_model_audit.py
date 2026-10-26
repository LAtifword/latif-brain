#!/usr/bin/env python3
"""Read-only Termux audit of LATIF NI model candidates. No external dependencies."""
import argparse
import json
import mmap
import re
import struct
from pathlib import Path

def u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]

def inspect_tflite(path):
    with path.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
        if data[4:8] != b"TFL3":
            return {"format": "unknown"}
        def table(pos):
            if not 0 <= pos < len(data) - 8:
                raise ValueError("Invalid table offset")
            return pos
        def field(pos, n):
            vtable = pos - struct.unpack_from("<i", data, pos)[0]
            length = struct.unpack_from("<H", data, vtable)[0]
            slot = 4 + n * 2
            return struct.unpack_from("<H", data, vtable + slot)[0] if slot + 2 <= length else 0
        def vec(pos, n):
            offset = field(pos, n)
            if not offset:
                return (0, 0)
            start = pos + offset
            start += u32(data, start)
            return (start + 4, u32(data, start))
        def child(base, index):
            offset = base + 4 * index
            return table(offset + u32(data, offset))
        def name(pos, n):
            offset = field(pos, n)
            if not offset:
                return ""
            start = pos + offset
            start += u32(data, start)
            size = min(u32(data, start), 256)
            return bytes(data[start + 4:start + 4 + size]).decode("utf-8", "replace")
        root = table(u32(data, 0))
        graphs, graph_count = vec(root, 2)
        result = {
            "format": "TFLite FlatBuffer",
            "version": u32(data, root + field(root, 0)) if field(root, 0) else 0,
            "operator_codes": vec(root, 1)[1],
            "subgraphs": graph_count,
            "buffers": vec(root, 4)[1],
        }
        if graph_count:
            graph = child(graphs, 0)
            tensors, count = vec(graph, 0)
            layers = set()
            examples = []
            for i in range(count):
                tensor_name = name(child(tensors, i), 3)
                layers.update(int(x) for x in re.findall(r"x_layers_(\d+)", tensor_name))
                if i < 8:
                    examples.append(tensor_name)
            result.update({
                "subgraph_name": name(graph, 4),
                "tensor_count": count,
                "inputs": vec(graph, 1)[1],
                "outputs": vec(graph, 2)[1],
                "operators": vec(graph, 3)[1],
                "transformer_layers": len(layers),
                "example_tensors": examples,
            })
        metadata, count = vec(root, 6)
        result["metadata_names"] = [name(child(metadata, i), 0) for i in range(min(count, 100))]
        return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", nargs="?", default="/storage/emulated/0/B")
    args = parser.parse_args()
    root = Path(args.directory)
    if not root.is_dir():
        parser.error("Directory is not accessible: " + str(root))
    report = {"directory": str(root), "files": []}
    for path in sorted(root.iterdir()):
        if not path.is_file() or path.suffix.lower() not in {".bin", ".gguf", ".safetensors", ".json", ".model", ".tflite"}:
            continue
        entry = {"name": path.name, "bytes": path.stat().st_size}
        if path.suffix.lower() in {".bin", ".tflite"}:
            try:
                entry.update(inspect_tflite(path))
            except (OSError, ValueError, struct.error, OverflowError) as exc:
                entry["inspection_error"] = str(exc)
        elif path.name == "config.json":
            try:
                config = json.loads(path.read_text())
                entry["model_type"] = config.get("model_type")
                entry["architecture"] = config.get("architectures")
            except (ValueError, OSError) as exc:
                entry["inspection_error"] = str(exc)
        report["files"].append(entry)
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
