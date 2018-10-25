/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json"; // spheres file loc
var Eye = new vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
var Center = new vec3.fromValues((WIN_RIGHT-WIN_LEFT)/2, (WIN_TOP-WIN_BOTTOM)/2, WIN_Z); // default center position
var Up = new vec3.fromValues(0, 1, 0);

var light = new vec3.fromValues(-3.0, 1.0, -0.5); // default light position in world space

var phongShader = null;
var blinnPhongShader = null;
var shader = null;

var highlightedModel = -1;

/* webgl globals */
var canvas;
var gl = null; // the all powerful gl object. It's all here folks!
var objects = [];
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // where to put normals for vertex shader

var ambientMaterialUniform; // where to put ambient material
var diffuseMaterialUniform; // where to put diffuse material
var specularMaterialUniform; // where to put specular material
var specularNMaterialUniform; // where to put specular n material
var eyeUniform; // where to put eye position
var lightUniform; // where to put light position
var viewMatrixUniform; // where to put position transform matrix
var modelMatrixUniform; // where to put model transform matrix
var modelInvTransMatrixUniform; // where to put the inverse transpose of the model transform matrix

/** Camera class */
class Camera {
    constructor(eye, center, up) {
        this.eye = eye;
        this.center = center;
        this.up = up;

        this.transform = mat4.create();
        mat4.lookAt(this.transform, this.eye, this.center, this.up);
    }

    /**
     * Translate the camera in the current orientation
     * @param {vec3} delta the direction to move relative to
     *                      the camera's current orientation
     */
    translate(delta) {
        var translate = mat4.create();
        mat4.fromTranslation(translate, delta);
        // Rotate the translation into the current frame of reference
        // Add the new translation
        mat4.multiply(this.transform, translate, this.transform);
    }

    /**
     * Rotate the camera around the Y axis
     * @param {float} delta the rotation delta in radians
     */
    rotateY(delta) {
        var rotate = mat4.create();
        mat4.fromYRotation(rotate, delta);

        mat4.multiply(this.transform, rotate, this.transform);
    }

    /**
     * Rotate the camera around the X axis
     * @param {float} delta the rotation delta in radians
     */
    rotateX(delta) {
        var rotate = mat4.create();
        mat4.fromXRotation(rotate, delta);

        mat4.multiply(this.transform, rotate, this.transform);
    }

    /**
     * Return viewing transform matrix
     */
    getTransform() {
        return this.transform;
    }

    /**
     * Return viewing transform matrix
     */
    getTransformInv() {
        var inv = mat4.create();
        mat4.invert(inv, this.transform);
        return inv;
    }

    /**
     * Return viewing transform matrix without translation
     */
    getTransformNT() {
        var transform = mat4.clone(this.transform);
        transform[12] = 0;
        transform[13] = 0;
        transform[14] = 0;
        return transform;
    }

    /**
     * Return viewing transform matrix without translation
     */
    getTransformInvNT() {
        var inv = this.getTransformNT()
        mat4.invert(inv, inv);
        return inv;
    }

    /**
     * Return eye position
     */
    getEye() {
        var eye = vec3.create();
        mat4.getTranslation(eye, this.getTransformInv());
        return eye;
    }
}

class Model {
    constructor(vertices, normals, indices, material) {
        this.triBufferSize = 0;
        var center = vec3.create();
        var coordArray = [];
        var normalArray = [];
        var indexArray = [];
        // set up the vertex coord array
        for (var i = 0; i < vertices.length; i++) {
            coordArray = coordArray.concat(vertices[i]);
            center[0] += vertices[i][0];
            center[1] += vertices[i][1];
            center[2] += vertices[i][2];
        }
        for (var i = 0; i < normals.length; i++) {
            normalArray = normalArray.concat(normals[i]);
        }

        this.triBufferSize += indices.length * 3;
        for (var i = 0; i < indices.length; i++) {
            indexArray = indexArray.concat(indices[i]);
        }

        this.material = {
            "ambient": vec3.fromValues(material.ambient[0], material.ambient[1], material.ambient[2]),
            "diffuse": vec3.fromValues(material.diffuse[0], material.diffuse[1], material.diffuse[2]),
            "specular": vec3.fromValues(material.specular[0], material.specular[1], material.specular[2]),
            "n": material.n
        };

        this.material_mods = {
            "ambient": 1,
            "diffuse": 1,
            "specular": 1
        }

        this.modelMatrix = mat4.create();
        this.modelRotationMatrix = mat4.create();
        this.modelScaleMatrix = mat4.create();
        this.locationMatrix = mat4.create();

        vec3.scale(center, center, -1/vertices.length);
        mat4.fromTranslation(this.locationMatrix, center); //translate the model to the origin
        vec3.scale(center, center, -1);
        mat4.fromTranslation(this.modelMatrix, center); //translate the model to its location

        this.vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        this.normalBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW); // coords to that buffer

        this.indexBuffer = gl.createBuffer(); // init empty index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer); // activate the buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // put indices in the buffer
    } //end Model constructor

    incrementSpecularN() {
        this.material.n++;
        if(this.material.n > 20) {
            this.material.n = 0;
        }
    }

    incrementAmbient() {
        this.material_mods.ambient += 0.1;
        if(this.material_mods.ambient > 1) {
            this.material_mods.ambient = 0;
        }
    }

    incrementDiffuse() {
        this.material_mods.diffuse += 0.1;
        if(this.material_mods.diffuse > 1) {
            this.material_mods.diffuse = 0;
        }
    }

    incrementSpecular() {
        this.material_mods.specular += 0.1;
        if(this.material_mods.specular > 1) {
            this.material_mods.specular = 0;
        }
    }

    /**
     * Translate the model in the current orientation
     * @param {vec3} delta the direction to move relative to
     *                      the camera's current orientation
     */
    translate(delta) {
        var translate = mat4.create();
        mat4.fromTranslation(translate, delta);

        // Transform the translation into the current view
        var op = mat4.create();
        mat4.multiply(op, camera.getTransform(), op);
        mat4.multiply(op, translate, op);
        mat4.multiply(op, camera.getTransformInv(), op);

        // Add the new translation
        mat4.multiply(this.modelMatrix, op, this.modelMatrix);
    }

    /**
     * Rotate the model around the X axis
     * @param {float} delta the rotation delta in radians
     */
    rotateX(delta) {
        var rotate = mat4.create();
        mat4.fromXRotation(rotate, delta);

        // Transform the rotation into the current view
        var op = mat4.create();
        mat4.multiply(op, camera.getTransformNT(), op);
        mat4.multiply(op, rotate, op);
        mat4.multiply(op, camera.getTransformInvNT(), op);

        // Add the new rotation
        mat4.multiply(this.modelRotationMatrix, op, this.modelRotationMatrix);
    }

    /**
     * Rotate the model around the Y axis
     * @param {float} delta the rotation delta in radians
     */
    rotateY(delta) {
        var rotate = mat4.create();
        mat4.fromYRotation(rotate, delta);

        // Transform the rotation into the current view
        var op = mat4.create();
        mat4.multiply(op, camera.getTransformNT(), op);
        mat4.multiply(op, rotate, op);
        mat4.multiply(op, camera.getTransformInvNT(), op);

        // Add the new rotation
        mat4.multiply(this.modelRotationMatrix, op, this.modelRotationMatrix);
    }

    /**
     * Rotate the model around the Y axis
     * @param {float} delta the rotation delta in radians
     */
    rotateZ(delta) {
        var rotate = mat4.create();
        mat4.fromZRotation(rotate, delta);

        // Transform the rotation into the current view
        var op = mat4.create();
        mat4.multiply(op, camera.getTransformNT(), op);
        mat4.multiply(op, rotate, op);
        mat4.multiply(op, camera.getTransformInvNT(), op);

        // Add the new rotation
        mat4.multiply(this.modelRotationMatrix, op, this.modelRotationMatrix);
    }

    /**
     * Draw the model
     * @param {bool} highlighted is this model highlighted
     */
    draw(highlighted) {
        var tempModelMatrix = mat4.create();
        mat4.multiply(tempModelMatrix, this.locationMatrix, tempModelMatrix);
        if(highlighted) {
            var scale = mat4.create();
            mat4.fromScaling(scale, vec3.fromValues(1.2, 1.2, 1.2));
            mat4.multiply(tempModelMatrix, scale, tempModelMatrix);
        }
        mat4.multiply(tempModelMatrix, this.modelScaleMatrix, tempModelMatrix);
        mat4.multiply(tempModelMatrix, this.modelRotationMatrix, tempModelMatrix);
        mat4.multiply(tempModelMatrix, this.modelMatrix, tempModelMatrix);

        gl.uniformMatrix4fv(modelMatrixUniform, false, tempModelMatrix);
        mat4.invert(tempModelMatrix, tempModelMatrix);
        mat4.transpose(tempModelMatrix, tempModelMatrix);
        gl.uniformMatrix4fv(modelInvTransMatrixUniform, false, tempModelMatrix);

        var ambient = vec3.create();
        vec3.scale(ambient, this.material.ambient, this.material_mods.ambient);
        gl.uniform3fv(ambientMaterialUniform, ambient);

        var diffuse = vec3.create();
        vec3.scale(diffuse, this.material.diffuse, this.material_mods.diffuse);
        gl.uniform3fv(diffuseMaterialUniform, diffuse);

        var specular = vec3.create();
        vec3.scale(specular, this.material.specular, this.material_mods.specular);
        gl.uniform3fv(specularMaterialUniform, specular);

        gl.uniform1f(specularNMaterialUniform, this.material.n);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer); // activate vertex buffer
        gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer); // activate vertex buffer
        gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0); // feed

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer); // activate index buffer
        gl.drawElements(gl.TRIANGLES, this.triBufferSize, gl.UNSIGNED_SHORT, 0);
    }
}//end Model class

class Shader {
    constructor(fShaderCode, vShaderCode) {
        this.is_valid = true;
        this.fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(this.fShader, fShaderCode); // attach code to shader
        gl.compileShader(this.fShader); // compile the code for gpu execution

        this.vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(this.vShader, vShaderCode); // attach code to shader
        gl.compileShader(this.vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(this.fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            this.is_valid = false;
            console.log("error during fragment shader compile: " + gl.getShaderInfoLog(this.fShader));
        } else if (!gl.getShaderParameter(this.vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            this.is_valid = false;
            console.log("error during vertex shader compile: " + gl.getShaderInfoLog(this.vShader));
        } else { // no compile errors
            this.shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(this.shaderProgram, this.fShader); // put frag shader in program
            gl.attachShader(this.shaderProgram, this.vShader); // put vertex shader in program
            gl.linkProgram(this.shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) { // bad program link
                this.is_valid = false;
                console.log("error during shader program linking: " + gl.getProgramInfoLog(this.shaderProgram));
            }
        } // end if no compile errors
    }

    activate() {
        if(!this.is_valid) {
            console.log("Cannot activate invalid shader");
            return;
        }
        gl.useProgram(this.shaderProgram); // activate shader program (frag and vert)
        vertexPositionAttrib = // get pointer to vertex shader input
            gl.getAttribLocation(this.shaderProgram, "vertexPosition");
        gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
        vertexNormalAttrib = // get pointer to vertex shader input
            gl.getAttribLocation(this.shaderProgram, "vertexNormal");
        gl.enableVertexAttribArray(vertexNormalAttrib); // input to shader from array

        ambientMaterialUniform = // get pointer to ambient material input
            gl.getUniformLocation(this.shaderProgram, "ambient");
        diffuseMaterialUniform = // get pointer to diffuse material input
            gl.getUniformLocation(this.shaderProgram, "diffuse");
        specularMaterialUniform = // get pointer to specular material input
            gl.getUniformLocation(this.shaderProgram, "specular");
        specularNMaterialUniform = // get pointer to specular material input
            gl.getUniformLocation(this.shaderProgram, "n");

        eyeUniform = // get pointer to eye location input
            gl.getUniformLocation(this.shaderProgram, "eye");
        lightUniform = // get pointer to light location input
            gl.getUniformLocation(this.shaderProgram, "light");

        viewMatrixUniform = // get pointer to view matrix input
            gl.getUniformLocation(this.shaderProgram, "view");
        modelMatrixUniform = // get pointer to model matrix input
            gl.getUniformLocation(this.shaderProgram, "model");
        modelInvTransMatrixUniform = // get pointer to model matrix input
            gl.getUniformLocation(this.shaderProgram, "invTransModel");

    }
}

var camera = new Camera(Eye, Center, Up);


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) {
        triBufferSize = 0;

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            objects.push(new Model( inputTriangles[whichSet].vertices,
                                    inputTriangles[whichSet].normals,
                                    inputTriangles[whichSet].triangles,
                                    inputTriangles[whichSet].material))
        } // end for each triangle set
    } // end if triangles found
} // end load triangles

// read ellipsoids in, load them into webgl buffers
function loadEllipsoids() {
    var inputSpheres = getJSONFile(INPUT_SPHERES_URL, "spheres");
    var sphereModel = getJSONFile("sphere_model.json", "sphere_model")
    if (inputSpheres != String.null) {
        triBufferSize = 0;

        for (var whichSet = 0; whichSet < inputSpheres.length; whichSet++) {
            var model = new Model( sphereModel.vertices,
                sphereModel.normals,
                sphereModel.triangles,
                inputSpheres[whichSet]
                );
            var translate = mat4.create();
            mat4.fromTranslation(translate,[inputSpheres[whichSet].x,
                                            inputSpheres[whichSet].y,
                                            inputSpheres[whichSet].z]);
            var scale = mat4.create();
            mat4.fromScaling(scale,[inputSpheres[whichSet].a,
                                    inputSpheres[whichSet].b,
                                    inputSpheres[whichSet].c]);
            mat4.multiply(model.modelScaleMatrix, scale, model.modelScaleMatrix);
            mat4.multiply(model.modelMatrix, translate, model.modelMatrix);

            objects.push(model);
        } // end for each triangle set
    } // end if triangles found
} // end load sphere model

// setup the webGL shaders
function setupShaders() {

    /********************************************************/
    /********************* Phong Shader *********************/
    /********************************************************/

    // define fragment shader in essl using es6 template strings
    var fPhongShaderCode = `#version 100
        precision mediump float;

        uniform vec3 ambient;
        uniform vec3 diffuse;
        uniform vec3 specular;
        uniform float n;

        uniform vec3 eye;
        uniform vec3 light;

        varying vec3 pos;
        varying vec3 normal;

        void main(void) {
            vec3 normal_n = normalize(normal);
            vec3 V = normalize(eye - pos);
            vec3 L = normalize(light - pos);
            vec3 R = normalize(2.0*normal_n*dot(normal_n, L) - L);

            gl_FragColor = vec4(ambient
                + diffuse * max(dot(normal_n, L), 0.0)
                + specular * pow(max(dot(R, V), 0.0), n)
            , 1.0);
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vPhongShaderCode = `#version 100
        uniform mat4 view;
        uniform mat4 model;
        uniform mat4 invTransModel;

        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec3 pos;
        varying vec3 normal;

        void main(void) {
            vec4 pos4 = model * vec4(vertexPosition, 1.0);
            gl_Position = view * pos4;

            pos = pos4.xyz;
            vec4 normal4 = invTransModel * vec4(vertexNormal, 1.0);
            normal = normalize(normal4.xyz);
        }
    `;

    /**********************************************************/
    /******************* Blinn Phong Shader *******************/
    /**********************************************************/

    // define fragment shader in essl using es6 template strings
    var fBlinnPhongShaderCode = `#version 100
        precision mediump float;

        uniform vec3 ambient;
        uniform vec3 diffuse;
        uniform vec3 specular;
        uniform float n;

        uniform vec3 eye;
        uniform vec3 light;

        varying vec3 pos;
        varying vec3 normal;

        void main(void) {
            vec3 normal_n = normalize(normal);
            vec3 V = normalize(eye - pos);
            vec3 L = normalize(light - pos);
            vec3 H = normalize(L + V);

            gl_FragColor = vec4(ambient
                + diffuse * max(dot(normal_n, L), 0.0)
                + specular * pow(max(dot(H, normal_n), 0.0), n)
            , 1.0);
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vBlinnPhongShaderCode = `#version 100
        uniform mat4 view;
        uniform mat4 model;
        uniform mat4 invTransModel;

        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec3 pos;
        varying vec3 normal;

        void main(void) {
            vec4 pos4 = model * vec4(vertexPosition, 1.0);
            gl_Position = view * pos4;

            pos = pos4.xyz;
            vec4 normal4 = invTransModel * vec4(vertexNormal, 1.0);
            normal = normalize(normal4.xyz);
        }
    `;

    phongShader = new Shader(fPhongShaderCode, vPhongShaderCode);

    blinnPhongShader = new Shader(fBlinnPhongShaderCode, vBlinnPhongShaderCode);

    //default shader
    shader = phongShader;
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    var transform = mat4.create();
    mat4.perspective(transform, Math.PI*0.5, canvas.width/canvas.height, 0.01, 100);

    mat4.multiply(transform, transform, camera.getTransform());

    gl.uniformMatrix4fv(viewMatrixUniform, false, transform);
    gl.uniform3fv(eyeUniform, camera.getEye());
    gl.uniform3fv(lightUniform, light);

    for(var i=0; i<objects.length; i++) {
        objects[i].draw((i===highlightedModel));
    }
} // end render triangles

/* MAIN -- HERE is where execution begins after window load */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    loadEllipsoids(); // load in the triangles from tri file

    setupShaders(); // setup the webGL shaders
    shader.activate();
    while(true) {
        handleKeys();
        renderTriangles(); // draw the triangles using webGL
        await sleep(10);
    }
} // end main

var keys = { 16: false };
function keydown(event) {
    keys[event.keyCode] = true;
}
function keyup(event) {
    keys[event.keyCode] = false;
}

const DELTA = 0.01;
const ROT_DELTA = 0.02;

function handleKeys() {
    var shift = keys[16];
    Object.keys(keys).forEach(function(code) {
        if( keys[code] ) {
            var char = String.fromCharCode(code);
            if(!shift) { char = char.toLowerCase(); }
            if(shift && char === ';') { char = ':'; }
            switch(char) {
                // Translation
                case 'a':
                    camera.translate(vec3.fromValues(DELTA, 0, 0));
                    break;
                case 'd':
                    camera.translate(vec3.fromValues(-DELTA, 0, 0));
                    break;
                case 's':
                    camera.translate(vec3.fromValues(0, 0, -DELTA));
                    break;
                case 'w':
                    camera.translate(vec3.fromValues(0, 0, DELTA));
                    break;
        
                case 'q':
                    camera.translate(vec3.fromValues(0, -DELTA, 0));
                    break;
                case 'e':
                    camera.translate(vec3.fromValues(0, DELTA, 0));
                    break;
        
                // Rotate
                case 'A':
                    camera.rotateY(-ROT_DELTA);
                    break;
                case 'D':
                    camera.rotateY(ROT_DELTA);
                    break;

                case 'W':
                    camera.rotateX(-ROT_DELTA);
                    break;
                case 'S':
                    camera.rotateX(ROT_DELTA);
                    break;


                case 'b':
                    keys[code] = false;
                    if(shader === phongShader) {
                        console.log("Blinn-Phong Shading");
                        shader = blinnPhongShader;
                    }
                    else {
                        console.log("Phong Shading");
                        shader = phongShader;
                    }
                    shader.activate();
                    break;

                case ' ':
                    keys[code] = false;
                    highlightedModel = -1;
                    break;
                default:
                    break;
            }
            // check arrow key codes
            if(code == 37) {
                //Left arrow
                keys[code] = false;
                highlightedModel--;
            }
            else if(code == 39) {
                //Right arrow
                keys[code] = false;
                highlightedModel++;
            }
            if(highlightedModel < -1) {
                highlightedModel = -1;
            }
            if(highlightedModel >= objects.length) {
                highlightedModel = 0;
            }
            if(highlightedModel == -1) {
                return;
            }

            //If there is a model highlighted
            switch(char) {
            case 'n':
                keys[code] = false;
                objects[highlightedModel].incrementSpecularN()
                break;
            case '1':
                keys[code] = false;
                objects[highlightedModel].incrementAmbient()
                break;
            case '2':
                keys[code] = false;
                objects[highlightedModel].incrementDiffuse()
                break;
            case '3':
                keys[code] = false;
                objects[highlightedModel].incrementSpecular()
                break;

            // Translations
            case 'k':
                objects[highlightedModel].translate(vec3.fromValues(-DELTA, 0, 0));
                break;
            case ';':
                objects[highlightedModel].translate(vec3.fromValues(DELTA, 0, 0));
                break;
            case 'o':
                objects[highlightedModel].translate(vec3.fromValues(0, 0, -DELTA));
                break;
            case 'l':
                objects[highlightedModel].translate(vec3.fromValues(0, 0, DELTA));
                break;
            case 'i':
                objects[highlightedModel].translate(vec3.fromValues(0, -DELTA, 0));
                break;
            case 'p':
                objects[highlightedModel].translate(vec3.fromValues(0, DELTA, 0));
                break;

            // Rotations
            case 'K':
                objects[highlightedModel].rotateY(ROT_DELTA);
                break;
            case ':':
                objects[highlightedModel].rotateY(-ROT_DELTA);
                break;
            case 'O':
                objects[highlightedModel].rotateX(ROT_DELTA);
                break;
            case 'L':
                objects[highlightedModel].rotateX(-ROT_DELTA);
                break;
            case 'I':
                objects[highlightedModel].rotateZ(ROT_DELTA);
                break;
            case 'P':
                objects[highlightedModel].rotateZ(-ROT_DELTA);
                break;
            }
        }
    });
}