/* GLOBAL CONSTANTS AND VARIABLES */
const SKYBOX_URL = "space.json"; // skybox file loc
const APPLE_URL = "gameApple.json"; // apple file loc
const SNAKE_BODY_URL = "snake_body.json"; // triangles file loc
var light = new vec3.fromValues(-300.0, 150.0, 50); // default light position in world space
var shader = null;

/* webgl globals */
var canvas;
var gl = null; // the all powerful gl object. It's all here folks!
var objects = [];
var models = {};
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // where to put normals for vertex shader
var textureCoordinateAttrib; // where to put texture coordinates for vertex shader

var ambientMaterialUniform; // where to put ambient material
var diffuseMaterialUniform; // where to put diffuse material
var specularMaterialUniform; // where to put specular material
var specularNMaterialUniform; // where to put specular n material
var alphaUniform; // where to put alpha
var eyeUniform; // where to put eye position
var lightUniform; // where to put light position
var samplerUniform; // where to put texture sampler
var viewMatrixUniform; // where to put position transform matrix
var modelMatrixUniform; // where to put model transform matrix
var modelInvTransMatrixUniform; // where to put the inverse transpose of the model transform matrix

var gameState = undefined;
var ControlsEnum = Object.freeze({ "up": 1, "down": 2, "left": 3, "right": 4, "rotateLeft": 5, "rotateRight": 6, "none": 7});

/** GameState class */
class GameState {
    constructor() {
        this.reset();
    }

    /** Returns a set of coordinates that act as the initial snake at the start of the game */
    createInitialSnake(length) {
        let dir = vec3.create();
        vec3.negate(dir, this.snakeDirection);
        let snake = [];
        for (let i = 0; i < length; i++) {
            snake.push(dir);
        }
        return snake;
    }

    reset() {
        this.dead = false;

        this.lastSnakeTick = Date.now();
        this.snakeTime = 0; //increments each time the snake moves forward
        this.snakeSpeed = 3.5; // Snake tick frequency: number of times the snake moves forward per second.
        this.snakeDirection = vec3.fromValues(0, 1, 0); //into the screen
        this.snakeUp = vec3.fromValues(0, 0, -1); //straight up
        this.lastControlInput = ControlsEnum.none;
        this.position = vec3.fromValues(0, 0, 0);
        this.snakePieces = this.createInitialSnake(100);
        this.apples = [];
        this.toGrow = 0;

        this.camera = this.createInitialCamera();
        this.minimapCamera = this.createInitialCamera();
        this.lastTickValues = {
            snakeDirection: vec3.clone(this.snakeDirection),
            snakeUp: vec3.clone(this.snakeUp),
            position: vec3.clone(this.position)
        }
        this.interpolation = {
            snakeDirection: vec3.create(),
            snakeUp: vec3.create(),
            position: vec3.create()
        }

        for (let i = 0; i < 5; i++) {
            this.growApple();
        }
    }

    /** Returns an initial camera. Uses `this.snakePieces` to determine where the initial camera should be */
    createInitialCamera() {
        return new Camera(vec3.clone(this.position), vec3.clone(this.snakeDirection), vec3.clone(this.snakeUp));
    }

    /** Main call point for updating the GameState. This function then determines which sub-updates to call for the GameState. */
    update() {
        let curTime = Date.now();
        if (curTime - this.lastSnakeTick >= 1000/this.snakeSpeed) {
            if (!this.dead) {
                this.lastSnakeTick = curTime;
                this.moveForward();
            }
        }
        this.updateCamera();
    }

    /** Updates time one tick forward, processing the user input,
     * and progressing the snake along the `snakeDirection` and updating the `snakePieces` list. */
    moveForward() {
        vec3.copy(this.lastTickValues.snakeDirection, this.snakeDirection);
        vec3.copy(this.lastTickValues.snakeUp, this.snakeUp);
        vec3.copy(this.lastTickValues.position, this.position);

        let snakeLeft = vec3.create(); vec3.cross(snakeLeft, this.snakeUp, this.snakeDirection); // we are in a weird left handed coordinate system

        switch (this.lastControlInput) {
            case ControlsEnum.left:
                this.snakeDirection = snakeLeft;
                break;

            case ControlsEnum.right:
                vec3.negate(this.snakeDirection, snakeLeft);
                break;

            case ControlsEnum.down:
                let oldUp = vec3.clone(this.snakeUp);
                vec3.copy(this.snakeUp, this.snakeDirection);
                vec3.negate(this.snakeDirection, oldUp);
                break;

            case ControlsEnum.up:
                let oldDirection = vec3.clone(this.snakeDirection);
                vec3.copy(this.snakeDirection, this.snakeUp);
                vec3.negate(this.snakeUp, oldDirection);
                break;

            case ControlsEnum.rotateLeft:
                vec3.copy(this.snakeUp, snakeLeft);
                break;

            case ControlsEnum.rotateRight:
                vec3.negate(this.snakeUp, snakeLeft);
                break;

            case ControlsEnum.none:
                break;
        }

        vec3.add(this.position, this.position, this.snakeDirection);

        // Add a new head piece
        this.snakePieces.unshift(vec3.fromValues(-this.snakeDirection[0],
                                                 -this.snakeDirection[1],
                                                 -this.snakeDirection[2]));

        let popped = undefined;
        if (this.toGrow > 0) {
            this.toGrow--;
        } else {
            // Pop the old tail
            popped = this.snakePieces.pop();
        }

        console.log(this.snakePieces.length);

        // Detect collision with itself
        let sum = vec3.create();
        for (let i = 0; i < this.snakePieces.length; i++) {
            vec3.add(sum, this.snakePieces[i], sum);
            if(vec3.length(sum) < 0.1) {
                showMenu("deathScreen");
                this.dead = true;
                vec3.copy(this.position, this.lastTickValues.position); //so that camera doesn't go inside
                this.snakePieces.shift();
                if (popped != undefined) {
                    this.snakePieces.push(popped);
                }
                break;
            }
        }

        // Detect collisions with apples
        for (let i = 0; i < this.apples.length; i++) {
            let difference = vec3.create();
            vec3.subtract(difference, this.position, this.apples[i]);
            if(vec3.length(difference) < 0.1) {
                this.toGrow += 5;
                console.log("Apple eaten!");
                this.apples.splice(i, 1);
                this.growApple();
            }
        }

        // At End
        this.lastControlInput = ControlsEnum.none; //input has been processed, clear it
        this.snakeTime++;
    }

    /** Grows a new apple somewhere on the play field that doesn't collide with the snake */
    growApple() {
        let applePos = this.getRandomPosition();

        let sum = vec3.clone(this.position);
        let difference = vec3.create();
        for (let i = 0; i < this.snakePieces.length; i++) {
            vec3.add(sum, this.snakePieces[i], sum);
            vec3.subtract(difference, sum, applePos);
            if(vec3.length(difference) < 0.1) {
                this.growApple();
                return;
            }
        }
        
        console.log("New apple in position: " + applePos);
        this.apples.push(applePos);
    }
    
    /** Returns a random valid position within the playing field */
    getRandomPosition() {
        let max = 10;
        let position = [];
        for (let i = 0; i < 3; i++) {
            position.push(Math.floor((Math.random() * max * 2) + 1) - max);
        }

        return position;
    }

    /** Updates the current camera positioning and rotation so that it is animated nicely */
    updateCamera() {
        let curTime = Date.now();
        let percent = (curTime - this.lastSnakeTick) * this.snakeSpeed / 1000.0;//percent of the way through the interpolation
        if ((curTime - this.lastSnakeTick) > 1000.0 / this.snakeSpeed) {
            percent = 1;
        }
        GameState.interpolate(this.interpolation.snakeDirection, this.lastTickValues.snakeDirection, this.snakeDirection, percent);
        GameState.interpolate(this.interpolation.snakeUp, this.lastTickValues.snakeUp, this.snakeUp, percent);
        GameState.interpolate(this.interpolation.position, this.lastTickValues.position, this.position, percent);

        vec3.copy(this.camera.eye, this.interpolation.position);
        vec3.add(this.camera.center, this.camera.eye, this.interpolation.snakeDirection);
        vec3.copy(this.camera.up, this.interpolation.snakeUp);
        mat4.lookAt(this.camera.transform, this.camera.eye, this.camera.center, this.camera.up);

        let interpLeft = vec3.create(); vec3.cross(interpLeft, this.interpolation.snakeUp, this.interpolation.snakeDirection);
        let upOff = vec3.create(); vec3.scale(upOff, this.interpolation.snakeUp, -50);
        let rightOff = vec3.create(); vec3.scale(rightOff, interpLeft, 100);
        let backOff = vec3.create(); vec3.scale(backOff, this.interpolation.snakeDirection, -80);

        let offset = vec3.create();
        vec3.add(offset, upOff, rightOff);
        vec3.add(offset, offset, backOff);

        vec3.copy(this.minimapCamera.eye, this.interpolation.position);
        vec3.add(this.minimapCamera.eye, this.minimapCamera.eye, offset);
        vec3.add(this.minimapCamera.center, this.minimapCamera.eye, this.interpolation.snakeDirection);
        // vec3.add(this.minimapCamera.center, this.minimapCamera.center, offset);
        vec3.copy(this.minimapCamera.up, this.interpolation.snakeUp);
        mat4.lookAt(this.minimapCamera.transform, this.minimapCamera.eye, this.minimapCamera.center, this.minimapCamera.up);
    }

    /** Interpolates from the vector `from` to the vector `to` by amount `percent` (between 0 and 1).
     * Puts the result into the vector `out`.
    */
    static interpolate(out, from, to, percent) {
        vec3.subtract(out, to, from);
        vec3.scale(out, out, percent);
        vec3.add(out, out, from);
    }

    /**
     *
     * @param {vec3} a the vector representing the section before the current section
     * @param {vec3} b the vector representing the current section
     * @param {vec3} c the vector representing the section after the current section
     */
    getPieceAndOrientation(a, b, c) {
        return [models["snake_body"], mat4.create()];
    }

    /** Draws the current game state */
    render(miniMapMode) {
        if (miniMapMode) {
            models["snake_body"].material.alpha = 0.3;
        } else {
            models["snake_body"].material.alpha = 1;
        }

        let camera = this.camera;
        if (miniMapMode) {
            camera = this.minimapCamera;
        }
        let transform = mat4.create();
        mat4.perspective(transform, Math.PI * 0.5, canvas.width / canvas.height, 0.1, 2000);
        mat4.multiply(transform, transform, camera.getTransform());
        gl.uniformMatrix4fv(viewMatrixUniform, false, transform);
        gl.uniform3fv(eyeUniform, camera.getEye());

        let translationMatrix = mat4.create();
        mat4.fromTranslation(translationMatrix, this.position);

        // Render snake pieces
        for (let i = 0; i < this.snakePieces.length; i++) {
            let segmentTranslationMatrix = mat4.create();
            mat4.fromTranslation(segmentTranslationMatrix, this.snakePieces[i]);
            mat4.multiply(translationMatrix, segmentTranslationMatrix, translationMatrix);

            let model = models["snake_body"];
            model.modelMatrix = translationMatrix;
            if (i > 0 || miniMapMode) {
                model.draw();
            }
        }

        // Render apples
        for (let i = 0; i < this.apples.length; i++) {
            this.drawWithTranslation(miniMapMode ? models["minimap_apple"] : models["apple"], this.apples[i]);
        }
    }

    drawWithTranslation(model, translation) {
        let translationMatrix = mat4.create();
        mat4.fromTranslation(translationMatrix, translation);

        model.modelMatrix = translationMatrix;
        model.draw();
    }


    // CONTROLS
    turnLeft() {
        this.lastControlInput = ControlsEnum.left;
    }

    turnRight() {
        this.lastControlInput = ControlsEnum.right;
    }

    turnUp() {
        this.lastControlInput = ControlsEnum.up;
    }

    turnDown() {
        this.lastControlInput = ControlsEnum.down;
    }

    rotateLeft() {
        this.lastControlInput = ControlsEnum.rotateLeft
    }

    rotateRight() {
        this.lastControlInput = ControlsEnum.rotateRight;
    }
}

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

    constructor(vertices, normals, uvs, indices, material) {
        this.triBufferSize = indices.length * 3;
        this.triangles = indices;
        var center = vec3.create();
        var coordArray = [];
        var normalArray = normals.flat();
        var textureArray = [];
        var indexArray = indices.flat();
        // set up the vertex coord array
        for (var i = 0; i < vertices.length; i++) {
            coordArray = coordArray.concat(vertices[i]);
            center[0] += vertices[i][0];
            center[1] += vertices[i][1];
            center[2] += vertices[i][2];
        }

        for (var i = 0; i < uvs.length; i++) {
            var uv = uvs[i];
            textureArray.push(uv[0]);
            textureArray.push(1-uv[1]);
        }

        this.material = {
            "ambient": vec3.fromValues(material.ambient[0], material.ambient[1], material.ambient[2]),
            "diffuse": vec3.fromValues(material.diffuse[0], material.diffuse[1], material.diffuse[2]),
            "specular": vec3.fromValues(material.specular[0], material.specular[1], material.specular[2]),
            "n": material.n,
            "alpha": material.alpha,
            "texture": getTextureFile(material.texture)
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

        this.textureBuffer = gl.createBuffer(); // init empty texture coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureArray), gl.STATIC_DRAW); // coords to that buffer

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
        mat4.multiply(op, gameState.camera.getTransform(), op);
        mat4.multiply(op, translate, op);
        mat4.multiply(op, gameState.camera.getTransformInv(), op);

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
        mat4.multiply(op, gameState.camera.getTransformNT(), op);
        mat4.multiply(op, rotate, op);
        mat4.multiply(op, gameState.camera.getTransformInvNT(), op);

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
        mat4.multiply(op, gameState.camera.getTransformNT(), op);
        mat4.multiply(op, rotate, op);
        mat4.multiply(op, gameState.camera.getTransformInvNT(), op);

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
        mat4.multiply(op, gameState.camera.getTransformNT(), op);
        mat4.multiply(op, rotate, op);
        mat4.multiply(op, gameState.camera.getTransformInvNT(), op);

        // Add the new rotation
        mat4.multiply(this.modelRotationMatrix, op, this.modelRotationMatrix);
    }

    /**
     * Return the center of the model
     */
    getCenter() {
        var center = vec3.create();
        mat4.getTranslation(center, this.modelMatrix);
        return center;
    }

    /**
     * Set the webgl attributes and uniforms for this model
     */
    _setAttributesAndUniforms() {
        var tempModelMatrix = mat4.create();
        mat4.multiply(tempModelMatrix, this.locationMatrix, tempModelMatrix);
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
        gl.uniform1f(alphaUniform, this.material.alpha);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer); // activate vertex buffer
        gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer); // activate normal buffer
        gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer); // activate texture buffer
        gl.vertexAttribPointer(textureCoordinateAttrib, 2, gl.FLOAT, false, 0, 0); // feed

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer); // activate index buffer

        // Activate texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.material.texture);
        gl.uniform1i(samplerUniform, 0);
    }

    /**
     * Draw the model
     */
    draw() {
        this._setAttributesAndUniforms();
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
        textureCoordinateAttrib = // get pointer to vertex shader input
            gl.getAttribLocation(this.shaderProgram, "vertexTextureCoord");
        gl.enableVertexAttribArray(textureCoordinateAttrib); // input to shader from array

        ambientMaterialUniform = // get pointer to ambient material input
            gl.getUniformLocation(this.shaderProgram, "ambient");
        diffuseMaterialUniform = // get pointer to diffuse material input
            gl.getUniformLocation(this.shaderProgram, "diffuse");
        specularMaterialUniform = // get pointer to specular material input
            gl.getUniformLocation(this.shaderProgram, "specular");
        specularNMaterialUniform = // get pointer to specular material input
            gl.getUniformLocation(this.shaderProgram, "n");
        alphaUniform = // get pointer to specular material input
            gl.getUniformLocation(this.shaderProgram, "alpha");

        eyeUniform = // get pointer to eye location input
            gl.getUniformLocation(this.shaderProgram, "eye");
        lightUniform = // get pointer to light location input
            gl.getUniformLocation(this.shaderProgram, "light");

        samplerUniform = // get pointer to texture sampler location
            gl.getUniformLocation(this.shaderProgram, "textureSampler");

        viewMatrixUniform = // get pointer to view matrix input
            gl.getUniformLocation(this.shaderProgram, "view");
        modelMatrixUniform = // get pointer to model matrix input
            gl.getUniformLocation(this.shaderProgram, "model");
        modelInvTransMatrixUniform = // get pointer to model matrix input
            gl.getUniformLocation(this.shaderProgram, "invTransModel");

    }
}

/**
 * Check if value is a power of 2
 *
 * From https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
 * @param {number} value
 */
function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

/**
 * Load texture from url
 * @param {String} url
 */
function getTextureFile(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Insert temporary single pixel while real texture is loaded
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

    // Load image
    var image = new Image();
    image.crossOrigin = "Anonymous";
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // If webgl can generate mipmaps
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.src = url;

    return texture;
}

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // transparent when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

/**
 * Load models
 */
async function loadModels() {
    fetch(SKYBOX_URL)
        .then(function(response) {
            return response.json();
        })
        .then(function(rawModels) {
            for(var i in rawModels) {
                let model = rawModels[i];
                objects.push(new Model(model.vertices, model.normals,
                        model.uvs, model.triangles, model.material));
            }
        });

    let applePromise = fetch(APPLE_URL)
        .then(function(response) {
            return response.json();
        })
        .then(function(model) {
            return new Model(model.vertices, model.normals,
                model.uvs, model.triangles, model.material);
        });
    
    let snakeBodyPromise = fetch(SNAKE_BODY_URL)
        .then(function(response) {
            return response.json();
        })
        .then(function(model) {
            return new Model(model.vertices, model.normals, model.uvs,
                            model.triangles, model.material);
        });

    let minimapApplePromise = fetch(SNAKE_BODY_URL)
        .then(function(response) {
            return response.json();
        })
        .then(function(model) {
            let material = model.material;
            material.diffuse = [1.0,0.1,0.1];
            material.ambient = [0.1,0.1,0.1];
            return new Model(model.vertices, model.normals, model.uvs,
                            model.triangles, material);
        });

    models["apple"] = await applePromise;
    models["snake_body"] = await snakeBodyPromise;
    models["minimap_apple"] = await minimapApplePromise;
} // end load models

// setup the webGL shaders
function setupShaders() {
    // shade fragments using blinn-phong and texture modulation
    var fModulateShaderCode = `#version 100
        precision mediump float;

        uniform vec3 ambient;
        uniform vec3 diffuse;
        uniform vec3 specular;
        uniform float n;
        uniform float alpha;

        uniform vec3 eye;
        uniform vec3 light;

        uniform sampler2D textureSampler;

        varying vec3 pos;
        varying vec3 normal;
        varying vec2 textureCoord;

        void main(void) {
            vec3 N = normalize(normal);
            vec3 V = normalize(eye - pos);
            vec3 L = normalize(light - pos);
            vec3 H = normalize(L + V);

            vec4 lightingColor = vec4(ambient
                + diffuse * abs(dot(N, L))
                + specular * pow(max(dot(H, N), 0.0), n)
            , alpha);
            vec4 textureColor = texture2D(textureSampler, textureCoord);
            gl_FragColor = lightingColor * textureColor;
        }
    `;

    var vModulateShaderCode = `#version 100
        uniform mat4 view;
        uniform mat4 model;
        uniform mat4 invTransModel;

        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        attribute vec2 vertexTextureCoord;

        varying vec3 pos;
        varying vec3 normal;
        varying vec2 textureCoord;

        void main(void) {
            vec4 pos4 = model * vec4(vertexPosition, 1.0);
            vec4 normal4 = invTransModel * vec4(vertexNormal, 1.0);

            gl_Position = view * pos4;
            pos = pos4.xyz;
            normal = normalize(normal4.xyz);
            textureCoord = vertexTextureCoord;
        }
    `;

    //default shader
    shader = new Shader(fModulateShaderCode, vModulateShaderCode);
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    var transform = mat4.create();
    mat4.perspective(transform, Math.PI*0.5, canvas.width/canvas.height, 0.1, 2000);

    mat4.multiply(transform, transform, gameState.camera.getTransform());

    gl.uniformMatrix4fv(viewMatrixUniform, false, transform);
    gl.uniform3fv(eyeUniform, gameState.camera.getEye());
    gl.uniform3fv(lightUniform, light);

    for(var i=0; i<objects.length; i++) {
        objects[i].draw();
    }
} // end render triangles