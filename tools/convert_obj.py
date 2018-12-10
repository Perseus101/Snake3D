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
            "alpha": 0.99,
            "texture": "space.jpg"
        },
        "vertices": [],
        "normals": [],
        "uvs": [],
        "triangles": []
    }
    meta = {
        "normals": [],
        "vertices": []
    }
    with open(filename, "r") as f:
        faceLoading = False

        for line in f.readlines():
            line = line.strip()
            if line.startswith("o"):
                print(line)
            elif line.startswith("v "):
                meta["vertices"].append(arr_float(line.split(" ")[1:]))
            elif line.startswith("vn"):
                meta["normals"].append(arr_float(line.split(" ")[1:]))
            elif line.startswith("vt"):
                data["uvs"].append(arr_float(line.split(" ")[1:]))
            elif line.startswith("f"):
                if (not faceLoading):
                    faceLoading = True

                    # If we will be doing index separation, we need to get data's normals initialized 
                    # to the right lengths. Otherwise, we just move them over in their current order.
                    if "/" in line:
                        data["normals"] = [None] * len(data["uvs"])
                        data["vertices"] = [None] * len(data["uvs"])
                    else:
                        data["normals"] = meta["normals"]
                        data["vertices"] = meta["vertices"]

                indices = line.split(" ")[1:]

                # If the faces are split into indices for the vertex, uvs, and normals separately,
                # Will reorganize them to work with current convention.
                if "/" in line:

                    for i in range(len(indices)):
                        idx = indices[i]
                        idxs = idx.split("/")
                        data["vertices"][int(idxs[1])-1] = meta["vertices"][int(idxs[0])-1]
                        data["normals"][int(idxs[1])-1] = meta["normals"][int(idxs[2])-1]
                        indices[i] = idxs[1]

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