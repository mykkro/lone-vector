(function() {
    var pressedKeys = {};
    var pressedOnce = {};

    function keyName(code) {
        switch(code) {
        case 13:
            return 'ENTER';
        case 16:
            return 'SHIFT';
        case 27:
            return 'ESC';
        case 32:
            return 'SPACE';
        case 37:
            return 'LEFT';
        case 38:
            return 'UP';
        case 39:
            return 'RIGHT';
        case 40:
            return 'DOWN';
        default:
            // Convert ASCII codes to letters
            return String.fromCharCode(code);
        }
    }

    function applyKey(key, status) {
        // remember fresh presses (ignores keyboard auto-repeat)
        if(status && !pressedKeys[key]) {
            pressedOnce[key] = true;
        }
        pressedKeys[key] = status;
    }

    function setKey(event, status) {
        var code = event.keyCode;
        applyKey(keyName(code), status);

        // keep arrows and space from scrolling the page
        if(code == 32 || (code >= 37 && code <= 40)) {
            event.preventDefault();
        }
    }

    document.addEventListener('keydown', function(e) {
        setKey(e, true);
    });

    document.addEventListener('keyup', function(e) {
        setKey(e, false);
    });

    window.addEventListener('blur', function() {
        pressedKeys = {};
    });

    window.input = {
        isDown: function(key) {
            return pressedKeys[key.toUpperCase()];
        },
        // true once per physical key press
        consume: function(key) {
            key = key.toUpperCase();
            var pressed = pressedOnce[key];
            pressedOnce[key] = false;
            return !!pressed;
        },
        // virtual key presses (touch controls)
        set: function(key, status) {
            key = key.toUpperCase();
            if(!!pressedKeys[key] != status) applyKey(key, status);
        },
        flush: function() {
            pressedOnce = {};
        }
    };
})();
