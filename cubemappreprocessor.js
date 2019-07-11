
class CubemapPreprocessor {
    constructor() {
        this.maps = {
            'px': undefined,
            'py': undefined,
            'pz': undefined,
            'nx': undefined,
            'ny': undefined,
            'nz': undefined,
        } 

        const directions = ['px', 'py', 'pz', 'nx', 'ny', 'nz'];
        const promises = [];

        for (const direction of directions) {
            const p = this.getImage(`#cube-map-${direction}`).then((result) => {
                this.maps[direction] = result;
            });
            promises.push(p);
        }
       
        Promise.all(promises).then(() => {
            this.preprocess();
        });
    }

    async getImage(url) {
        const domElement = $(url).get()[0];
        if (domElement === undefined) {
            console.log(`Error during loading cubemap face ${url}`);
        }

        const blobUrl = domElement.src;

        let image = undefined;
        await Jimp.read(blobUrl).then((result) => {
            image = result;
        });

        return image;
    }

    preprocess() {
        console.log(this.maps);
        
        const element = $('#preprocess-canvas')[0];
        const canvas = new gloperate.Canvas(element, { antialias: false });
        const renderer = new CubemapPreprocessorRenderer();

        canvas.renderer = renderer;
        renderer.controller = canvas.controller; 
       
        // renderer.onFrame();
    }
}

class CubemapPreprocessorRenderer extends gloperate.Renderer {
    constructor() {
        super();
    }

    onInitialize() {
        return true;
    }

    onUpdate() {
        return true;
    }

    onPrepare() { }

    onSwap() { }

    onFrame() {
        const gl = this._context.gl;
    }
}
