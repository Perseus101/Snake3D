const MENUS = ["mainMenu", "optionsMenu", "deathScreen"];
var activeMenu = "mainMenu";

var invertY = false;
function setInvertY(val) {
    invertY = val;
}
function updateInvertY(elem) {
    setInvertY(elem.checked);
}

var musicEnabled = true;
function setMusicEnabled(val) {
    musicEnabled = val;
}
function updateMusicEnabled(elem) {
    setMusicEnabled(elem.checked);
}
/**
 * Show the menu with the given id
 * @param {String} id the id of the menu to show
 */
function showMenu(id) {
    for(var menuIdx in MENUS) {
        let menuElement = document.getElementById(MENUS[menuIdx]);
        menuElement.classList.add("hidden");
    }
    let menu = document.getElementById(id);
    menu.classList.remove("hidden");
    activeMenu = id;
}

/**
 * Reset the game state
 */
function reset() {
    for(var menuIdx in MENUS) {
        let menuElement = document.getElementById(MENUS[menuIdx]);
        menuElement.classList.add("hidden");
    }
    gameState.reset();
}

/**
 * Setup variables and data on startup
 */
async function setup() {
    let modelLoadPromise = loadModels(); // Start loading models
    setupWebGL(); // set up the webGL environment

    setupShaders(); // setup the webGL shaders
    shader.activate();

    gameState = new GameState();

    await modelLoadPromise; // Wait for models to finish loading
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    var mainMenu = document.getElementById("mainMenu");
    mainMenu.classList.add("hidden");

    gameState.reset();

    while(true) {
        gameState.update();
        renderTriangles(); // draw the triangles using webGL
        gameState.render(false);
        gl.clear(gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
        gameState.render(true);
        await sleep(30);
    }
} // end main

function keydown(event) {
    if (gameState == undefined) {
        return;
    }

    let code = event.keyCode;

    var char = String.fromCharCode(code);
    switch (char) {
        case 'A':
            gameState.turnLeft();
            break;
        case 'D':
            gameState.turnRight();
            break;
        case 'S':
            if( invertY ) {
                gameState.turnUp();
            }
            else {
                gameState.turnDown();
            }
            break;
        case 'W':
            if( invertY ) {
                gameState.turnDown();
            }
            else {
                gameState.turnUp();
            }
            break;
        case 'Q':
            gameState.rotateLeft();
            break;
        case 'E':
            gameState.rotateRight();
            break;

        case ' ':
            if(activeMenu === MENUS[2]) {
                reset();
            }
            break;

        default:
            break;
    }
    // check arrow key codes
    if (code == 37) {
        //Left arrow
        gameState.turnLeft();
    }
    else if (code == 39) {
        //Right arrow
        gameState.turnRight();
    }
    else if (code == 38) {
        //Up arrow
        gameState.turnUp();
    }
    else if (code == 40) {
        //Down arrow
        gameState.turnDown();
    }
}