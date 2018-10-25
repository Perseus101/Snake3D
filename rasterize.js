/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
var Center = new vec3.fromValues((WIN_RIGHT-WIN_LEFT)/2, (WIN_TOP-WIN_BOTTOM)/2, WIN_Z); // default center position
var Up = new vec3.fromValues(0, 1, 0);

var light = new vec3.fromValues(-3.0, 1.0, -0.5); // default light position in world space

var phongShader = null;
var blinnPhongShader = null;
var shader = null;

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
var transformMatrixUniform; // where to put position transform matrix

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
        var coordArray = [];
        var normalArray = [];
        var indexArray = [];
        // set up the vertex coord array
        for (var i = 0; i < vertices.length; i++) {
            coordArray = coordArray.concat(vertices[i]);
        }
        for (var i = 0; i < normals.length; i++) {
            normalArray = normalArray.concat(normals[i]);
        }

        this.triBufferSize += indices.length * 3;
        for (var i = 0; i < indices.length; i++) {
            indexArray = indexArray.concat(indices[i]);
        }

        this.material = material;

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

    draw() {
        gl.uniform3fv(ambientMaterialUniform, this.material.ambient);
        gl.uniform3fv(diffuseMaterialUniform, this.material.diffuse);
        gl.uniform3fv(specularMaterialUniform, this.material.specular);
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

        transformMatrixUniform = // get pointer to transform matrix input
            gl.getUniformLocation(this.shaderProgram, "transform");
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
            objects.push(new Model(  inputTriangles[whichSet].vertices,
                                        inputTriangles[whichSet].normals,
                                        inputTriangles[whichSet].triangles,
                                        inputTriangles[whichSet].material))
        } // end for each triangle set
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {

    /********************************************************/
    /********************* Phong Shader *********************/
    /********************************************************/

    // define fragment shader in essl using es6 template strings
    var fPhongShaderCode = `
        precision mediump float;
        varying vec4 color;

        void main(void) {
            gl_FragColor = color;
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vPhongShaderCode = `
        uniform vec3 ambient;
        uniform vec3 diffuse;
        uniform vec3 specular;
        uniform float n;

        uniform mat4 transform;
        uniform vec3 eye;
        uniform vec3 light;

        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec4 color;
        varying vec3 vertPos;

        void main(void) {
            gl_Position = transform * vec4(vertexPosition, 1.0);

            vec3 V = normalize(eye - vertexPosition);
            vec3 L = normalize(light - vertexPosition);
            vec3 R = normalize(2.0*vertexNormal*dot(vertexNormal, L) - L);

            color = vec4(ambient
                    + diffuse * abs(dot(vertexNormal, L))
                    + specular * pow(abs(dot(R, V)), n)
                , 1.0);
        }
    `;

    /**********************************************************/
    /******************* Blinn Phong Shader *******************/
    /**********************************************************/

    // define fragment shader in essl using es6 template strings
    var fBlinnPhongShaderCode = `
        precision mediump float;
        varying vec4 color;

        void main(void) {
            gl_FragColor = color;
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vBlinnPhongShaderCode = `
        uniform vec3 ambient;
        uniform vec3 diffuse;
        uniform vec3 specular;
        uniform float n;

        uniform mat4 transform;
        uniform vec3 eye;
        uniform vec3 light;

        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        varying vec4 color;
        varying vec3 vertPos;

        void main(void) {
            gl_Position = transform * vec4(vertexPosition, 1.0);

            vec3 V = normalize(eye - vertexPosition);
            vec3 L = normalize(light - vertexPosition);
            vec3 H = normalize(L + V);

            color = vec4(ambient
                    + diffuse * abs(dot(vertexNormal, L))
                    + specular * pow(abs(dot(H, vertexNormal)), n)
                , 1.0);
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

    gl.uniformMatrix4fv(transformMatrixUniform, false, transform);
    gl.uniform3fv(eyeUniform, camera.getEye());
    gl.uniform3fv(lightUniform, light);

    for(var i=0; i<objects.length; i++) {
        objects[i].draw();
    }
} // end render triangles

/* MAIN -- HERE is where execution begins after window load */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
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
const ROT_DELTA = 0.01;

function handleKeys() {
    var shift = keys[16];
    Object.keys(keys).forEach(function(code) {
        if( keys[code] ) {
            var char = String.fromCharCode(code);
            if(!shift) { char = char.toLowerCase(); }
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
                case 'n':
                    keys[code] = false;
                    console.log("Exp");
                    break;
                case '1':
                    keys[code] = false;
                    console.log("1");
                    break;
                case '2':
                    keys[code] = false;
                    console.log("2");
                    break;
                case '3':
                    keys[code] = false;
                    console.log("3");
                    break;

                case ' ':
                    keys[code] = false;
                    console.log("space");
                    break;
                default:
                    break;
            }
            // check arrow key codes
            if(code == 37) {
                //Left arrow
                keys[code] = false;
            }
            else if(code == 39) {
                //Right arrow
                keys[code] = false;
            }
        }
    });
}