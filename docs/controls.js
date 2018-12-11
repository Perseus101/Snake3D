const MENUS = ["mainMenu", "optionsMenu", "deathScreen", "scoreText", "controlsMenu", "orientationMenu"];
const DEFAULT_INVERT_Y = false;
const DEFAULT_MUSIC_ENABLED = true;
const DEFAULT_COLOR = "57BC57";

var activeMenu = "mainMenu";

var invertY = DEFAULT_INVERT_Y;
function setInvertY(val) {
    invertY = val;
}
function updateInvertY(elem) {
    setInvertY(elem.checked);
}

var musicEnabled = DEFAULT_MUSIC_ENABLED;
function setMusicEnabled(val) {
    musicEnabled = val;
}
function updateMusicEnabled(elem) {
    setMusicEnabled(elem.checked);
}

function setColor(val) {
    let rHex = val.substr(0,2);
    let gHex = val.substr(2,2);
    let bHex = val.substr(4,2);

    let r = parseInt(rHex, 16) / 255;
    let g = parseInt(gHex, 16) / 255;
    let b = parseInt(bHex, 16) / 255;

    for(var menuIdx in MENUS) {
        if(menuIdx == 2) {
            // Skip the death menu, since it will be against the snake body
            continue;
        }
        let menuElement = document.getElementById(MENUS[menuIdx]);
        menuElement.style.color = "#" + val;
    }

    models["snake_body"].material.ambient[0] = r * 0.2;
    models["snake_body"].material.ambient[1] = g * 0.2;
    models["snake_body"].material.ambient[2] = b * 0.2;

    models["snake_body"].material.diffuse[0] = r * 0.6;
    models["snake_body"].material.diffuse[1] = g * 0.6;
    models["snake_body"].material.diffuse[2] = b * 0.6;

    models["snake_body"].material.specular[0] = r * 0.2;
    models["snake_body"].material.specular[1] = g * 0.2;
    models["snake_body"].material.specular[2] = b * 0.2;
}

function updateSnakeColor(elem) {
    setColor(elem.value);
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
 * Reset the menu options to defaults
 */
function resetOptions() {
    // Reset invert y
    setInvertY(DEFAULT_INVERT_Y);
    document.getElementById("invertY").checked = invertY;

    // Reset enable music
    setMusicEnabled(DEFAULT_MUSIC_ENABLED);
    document.getElementById("musicEnabled").checked = musicEnabled;

    setColor(DEFAULT_COLOR);
    document.getElementById("snakeColor").value = DEFAULT_COLOR;
}

/**
 * Reset the game state
 */
function reset() {
    for(var menuIdx in MENUS) {
        let menuElement = document.getElementById(MENUS[menuIdx]);
        menuElement.classList.add("hidden");
    }
    showMenu("scoreText");
    gameState.reset();
}

/**
 * Toggle fullscreen
 * From: https://developers.google.com/web/fundamentals/native-hardware/fullscreen/
 */
function toggleFullScreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    }
    else {
        cancelFullScreen.call(doc);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var doneSettingUp = false;

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
    // Reset the options menu
    updateInvertY(document.getElementById("invertY"));
    updateMusicEnabled(document.getElementById("musicEnabled"));
    updateSnakeColor(document.getElementById("snakeColor"));

    // device detection
    // from https://stackoverflow.com/a/3540295/7753381
    if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)
        || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4))) {
        // Mobile device detected
        while (window.innerHeight > window.innerWidth) {
            showMenu(MENUS[5]);
            await sleep(30);
        }
        showMenu(MENUS[0]);
    }

    doneSettingUp = true;
}

async function main() {
    while (!doneSettingUp) {
        await sleep(30);
    }

    var mainMenu = document.getElementById("mainMenu");
    mainMenu.classList.add("hidden");

    if ( musicEnabled ) {
        document.getElementById("myAudio").play();
    }

    showMenu("scoreText");

    gameState.reset();

    while(true) {
        gameState.update();
        updateModels();
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
        if( invertY ) {
            gameState.turnDown();
        }
        else {
            gameState.turnUp();
        }
    }
    else if (code == 40) {
        //Down arrow
        if( invertY ) {
            gameState.turnUp();
        }
        else {
            gameState.turnDown();
        }
    }
}

/************************************ Touch Input ************************************/
// From: https://stackoverflow.com/a/23230280/7753381
document.addEventListener('touchstart', handleTouchStart, false);
document.addEventListener('touchmove', handleTouchMove, false);

var xDown = null;
var yDown = null;

function handleTouchStart(evt) {
    const firstTouch = evt.touches[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
};

function handleTouchMove(evt) {
    if ( ! xDown || ! yDown ) {
        return;
    }

    var xUp = evt.touches[0].clientX;
    var yUp = evt.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {/*most significant*/
        if ( xDiff > 0 ) {
            /* left swipe */
            gameState.turnLeft();
        } else {
            /* right swipe */
            gameState.turnRight();
        }
    } else {
        if ( yDiff > 0 ) {
            /* up swipe */
            if( invertY ) {
                gameState.turnDown();
            }
            else {
                gameState.turnUp();
            }
        } else {
            /* down swipe */
            if( invertY ) {
                gameState.turnUp();
            }
            else {
                gameState.turnDown();
            }
        }
    }
    /* reset values */
    xDown = null;
    yDown = null;
};