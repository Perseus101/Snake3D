import json

def arr_float(arr):
    """
    Convert an array of float strings to an array of floats
    """
    out = [None] * len(arr)
    for i in range(len(arr)):
        out[i] = float(arr[i])
    return out

def dec_all(arr):
    """
    Decrement all elements in an array of integers by 1
    """
    return [int(x) - 1 for x in arr]

def parse_obj(filename):
    data = {
        "material": {
            "ambient": [0.1,0.1,0.1],
            "diffuse": [0.6,0.6,0.6],
            "specular": [0.3,0.3,0.3],
            "n": 11,
            "alpha": 0.9,
            "texture": ""
        },
        "vertices": [],
        "normals": [],
        "uvs": [],
        "triangles": []
    }
    with open(filename, "r") as f:
        for line in f.readlines():
            line = line.strip()
            if line.startswith("o"):
                print(line)
            elif line.startswith("v "):
                data["vertices"].append(arr_float(line.split(" ")[1:]))
            elif line.startswith("vn"):
                data["normals"].append(arr_float(line.split(" ")[1:]))
            elif line.startswith("vt"):
                data["uvs"].append(arr_float(line.split(" ")[1:]))
            elif line.startswith("f"):
                indices = line.split(" ")[1:]
                if "/" in line:
                    # Although OBJ files can technically index vertices, normals,
                    # and texture coordinates separately, our format can not
                    for i in range(len(indices)):
                        idx = indices[i]
                        idxs = idx.split("/")
                        if not all(x == idxs[0] for x in idxs):
                            raise ValueError("This model has separate indexing, which is not supported")
                        else:
                            indices[i] = idxs[0]
                data["triangles"].append(dec_all(arr_float(indices)))

    return data

if __name__ == "__main__":
    from argparse import ArgumentParser
    parser = ArgumentParser(description="Convert an obj file into our weird JSON format")
    parser.add_argument("-f", "--file", required=True, help="The OBJ file to convert")
    parser.add_argument("-o", "--output", required=True, help="The file to output to")

    args = parser.parse_args()

    data = parse_obj(args.file)

    with open(args.output, "w") as f:
        json.dump(data, f, sort_keys=True, indent=4, separators=(',', ': '))