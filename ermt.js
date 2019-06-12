

class Renderer extends gloperate.Renderer {

    SHADER_SOURCE_VERT =
`precision highp float;

#if __VERSION__ == 100
    attribute vec2 a_vertex;
#else
    in vec2 a_vertex;
    #define varying out
#endif

uniform vec2 u_ndcOffset;
uniform ivec2 u_mode;

varying vec2 v_uv;
varying vec4 v_ray;

void main(void)
{
    vec2 v = a_vertex;// + u_ndcOffset;
    vec3 rays[18] = vec3[](
        vec3(  1.0, -v.y, -v.x), // px
        vec3( -1.0, -v.y,  v.x), // nx
        vec3(  v.x,  1.0,  v.y), // py
        vec3(  v.x, -1.0, -v.y), // ny
        vec3(  v.x, -v.y,  1.0), // pz
        vec3( -v.x, -v.y, -1.0), // nz
    
        vec3(  1.0,  0.0,  0.0), // px
        vec3( -1.0,  0.0,  0.0), // nx
        vec3(  0.0,  1.0,  0.0), // py
        vec3(  0.0, -1.0,  0.0), // ny
        vec3(  0.0,  0.0,  1.0), // pz
        vec3(  0.0,  0.0, -1.0), // nz
    
        vec3(  1.0,  0.0,  0.0), // px
        vec3( -1.0,  0.0,  0.0), // nx
        vec3(  0.0,  1.0,  0.0), // py
        vec3(  0.0, -1.0,  0.0), // ny
        vec3(  0.0,  0.0,  1.0), // pz
        vec3(  0.0,  0.0, -1.0)  // nz
    );
    
    v_uv = a_vertex;
    v_ray = vec4(rays[u_mode[0]], 0.0);
    
    gl_Position = vec4(a_vertex.xy + u_ndcOffset, 0.0, 1.0);
}
`;

    SHADER_SOURCE_FRAG =
`precision highp float;
precision highp int;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
    #define varying in
#endif

uniform ivec2 u_mode;

uniform sampler2D u_equirectmap;

varying vec2 v_uv;
varying vec4 v_ray;

const float PI         = 3.1415926535897932384626433832795;
const float OneOver2PI = 0.1591549430918953357688837633725;
const float OneOverPI  = 0.3183098861837906715377675267450;


vec3 cubeTransform(in vec2 uv, in vec3 ray, in int mode) {
    return ray;
}


vec3 sphereTransform(in vec2 uv, in vec3 ray, in int mode) {

    float zz = 1.0 - dot(uv, uv);
    // if(zz < 0.0) return -ray;

    if(mode == 0) 
        return reflect(-ray, vec3(  sqrt(zz), -uv.y, -uv.x)); // px
    if(mode == 1) return reflect(-ray, vec3( -sqrt(zz), -uv.y,  uv.x)); // nx
    if(mode == 2) return reflect(-ray, vec3(  uv.x,  sqrt(zz),  uv.y)); // py
    if(mode == 3) return reflect(-ray, vec3(  uv.x, -sqrt(zz), -uv.y)); // ny
    if(mode == 4) return reflect(-ray, vec3(  uv.x, -uv.y,  sqrt(zz))); // pz
                  return reflect(-ray, vec3( -uv.x, -uv.y, -sqrt(zz))); // nz
}


vec3 paraboloidTransform(in vec2 uv, in vec3 ray, in int mode) {

    vec3 foo;

         if(mode == 0) foo = vec3(  1.0, -uv.y, -uv.x); // px
    else if(mode == 1) foo = vec3( -1.0, -uv.y,  uv.x); // nx
    else if(mode == 2) foo = vec3(  uv.x,  1.0,  uv.y); // py
    else if(mode == 3) foo = vec3(  uv.x, -1.0, -uv.y); // ny
    else if(mode == 4) foo = vec3(  uv.x, -uv.y,  1.0); // pz
    else if(mode == 5) foo = vec3( -uv.x, -uv.y, -1.0); // nz

    return reflect(-ray, normalize(foo));
}

// float catmulrom(float x) {
//     float B = 0.0;
//     float C = 0.5;
//     float f = x;

//     if(f < 0.0) {
//         f = -f;
//     }

//     if(f < 1.0) {
//         return ((+12.0 -  9.0 * B - 6.0 * C) * (f * f * f) 
//               + (-18.0 + 12.0 * B + 6.0 * C) * (f * f) 
//               + (+ 6.0 -  2.0 * B)) / 6.0;
//     }

//     if (f > 1.0 && f < 2.0) {
//         return ((- 1.0 * B -  6.0 * C) * (f * f * f) 
//               + (+ 6.0 * B + 30.0 * C) * (f * f) 
//               + (-12.0 * B - 48.0 * C) * f
//               + (+ 8.0 * B + 24.0 * C)) / 6.0;
//     }
//     return 0.0;
// }

// vec4 sharpen(in sampler2D sampler, in vec2 uv) {

//     vec2 size = 1.0 / vec2(textureSize(sampler, 0));
//     vec4 result = vec4(0.0);
//     float weights = 0.0;

//     for(int y = -4; y < 5; ++y)
//         for(int x = -4; x < 5; ++x) {
//             float f = sqrt(float(x) * float(x) + float(y) * float(y));
//             float w = catmulrom(f);
//             result += w * texture(sampler, uv + vec2(float(x), float(y)) * size);
//             weights += w;
//         }

//     return result / weights;
// }


void main(void)
{
    vec3 ray = normalize(v_ray.xyz);

    if(u_mode[0] < 6) {
        ray = cubeTransform(v_uv, ray, u_mode[0]);
    } else if (u_mode[0] < 12) {
        ray = sphereTransform(v_uv, ray, u_mode[0] - 6);
    } else if (u_mode[0] < 18) {
        ray = paraboloidTransform(v_uv, ray, u_mode[0] - 12);
    }

    if(u_mode[1] == 1) {
        fragColor = vec4(ray * 0.5 + 0.5, 1.0);
        return;
    }

    float v = acos(ray.y) * OneOverPI;
    float m = atan(ray.x, ray.z);

    vec2 uv = vec2(m * OneOver2PI + 0.5, v);
    fragColor = texture(u_equirectmap, uv);
    // fragColor = sharpen(u_equirectmap, uv);
}
`;
    controller = null;


    _ndcRectangle = null;

    _program = null;
    _uMode = null;
    
    _ndcOffsetKernel = null;
    _uNdcOffset = null;
    
    _preview = null;

    _sourceTexture = null;
    _debug = true;

    _targetTexture = null;
    _targetFBO = null;

    _queue = new Array();
    _task = null;

    _accumulate = null;


    onInitialize(context, callback, mouseEventProvider) {

        const gl = this._context.gl;

        this._ndcRectangle = new gloperate.NdcFillingRectangle(this._context, 'NdcFillingRectangle');
        this._ndcRectangle.initialize();


        const internalFormatAndType = gloperate.Wizard.queryInternalTextureFormat(
            this._context, gl.RGB, gloperate.Wizard.Precision.byte);


        this._targetTexture = new gloperate.Texture2D(this._context, 'TargetTexture');
        this._targetTexture.initialize(1, 1, 
            internalFormatAndType[0], gl.RGB, internalFormatAndType[1]);

        this._targetFBO = new gloperate.Framebuffer(this._context, 'TargetFBO');
        this._targetFBO.initialize([[this._context.gl2facade.COLOR_ATTACHMENT0, this._targetTexture] ]);      
        this._targetFBO.bind();
    

        this._sourceTexture = new gloperate.Texture2D(this._context);
        this._sourceTexture.initialize(1, 1, internalFormatAndType[0], gl.RGB, internalFormatAndType[1]);


        const vert = new gloperate.Shader(this._context, gl.VERTEX_SHADER, 'ndc-rectangle (in-line)');
        vert.initialize(this.SHADER_SOURCE_VERT);

        const frag = new gloperate.Shader(this._context, gl.FRAGMENT_SHADER, 'transform (in-line)');
        frag.initialize(this.SHADER_SOURCE_FRAG);

        this._program = new gloperate.Program(this._context, 'TransformProgram');
        this._program.initialize([vert, frag], false);


        this._program.attribute('a_vertex', this._ndcRectangle.vertexLocation);
        this._program.link();       

        this._program.bind();
        gl.uniform1i(this._program.uniform('u_equirectmap'), 0);

        this._uNdcOffset = this._program.uniform('u_ndcOffset');
        this._uMode = this._program.uniform('u_mode');


        this._ndcRectangle.bind();


        this._accumulate = new gloperate.AccumulatePass(this._context);
        this._accumulate.initialize();
        this._accumulate.precision = gloperate.Wizard.Precision.byte;


        return true;
    }

    onUpdate() { 
        return this._queue.length > 0;
    }

    onPrepare() {

        const gl = this._context.gl;

        const [ identifier, size, samples, debug ] = this._task = this._queue.shift();

        const offsets = { 'cube': 0, 'sphere': 6, 'paraboloid': 12 };
        const indizes = { 'px': 0, 'nx': 1, 'py': 2, 'ny': 3, 'pz': 4, 'nz': 5 };

        const [o, i] = identifier.split('-map-');
        const mode = offsets[o] + indizes[i];

        this._targetTexture.resize(size, size, true, true); 
        this._accumulate.texture = this._targetTexture;
        this._accumulate.update();

        this._ndcOffsetKernel = new gloperate.AntiAliasingKernel(samples);

        this._program.bind();
        gl.uniform2i(this._uMode, mode, debug);
        this._program.unbind();
    }

    onSwap() { }

    onFrame() {

        if(this._task === null) {
            return;
        }

        const size = this._task[1];
        const samples = this._task[2];

        const gl = this._context.gl;

        gl.viewport(0, 0, size, size);
       
        for(let frameNumber = 0; frameNumber < samples; ++frameNumber) {

            this._sourceTexture.bind(gl.TEXTURE0);

            this._targetFBO.bind();
            this._program.bind();

            const ndcOffset = this._ndcOffsetKernel.get(frameNumber);

            ndcOffset[0] = 2.0 * ndcOffset[0] / size;
            ndcOffset[1] = 2.0 * ndcOffset[1] / size;

            gl.uniform2fv(this._uNdcOffset, ndcOffset);


            this._ndcRectangle.bind();
            this._ndcRectangle.draw();
            this._ndcRectangle.unbind();

            this._program.unbind();

            this._targetFBO.unbind();
            this._accumulate.frame(frameNumber);
        }

        this._accumulate.framebuffer.bind();

        const rgba = new Uint8Array(size * size * 4);
        gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, rgba)


        const image = new jimp(size, size);  
        image.bitmap.data = rgba;

        let buffer = null;
        image.getBuffer('image/png', (error, result) => buffer = result);
        
        const identifier = this._task[0];
        const img = $(`#${identifier}`);
        
        const blob = new Blob([buffer], {type: 'image/png'});
        const url = window.URL.createObjectURL(blob);
        
        img.attr('src', url); 
        img.parent().attr('href', url);


        this._task = null;
        if(this._queue.length > 0) {
            this.invalidate();
        }
    }

    compute(identifier, size, samples) {  
        this._queue.push([ identifier, Math.min(8192, Math.max(8, size)), samples, this._debug ]);
        this.invalidate();
    }

    input(file, callback) {

        this._debug = true;

        var fr = new FileReader();
        fr.onload = () => {
            this._sourceTexture.load(fr.result).then(() => {
                const gl = this._context.gl;

                this._sourceTexture.bind(gl.TEXTURE0);
                this._sourceTexture.wrap(gl.REPEAT, gl.REPEAT, false, false);
                this._sourceTexture.filter(gl.LINEAR, gl.LINEAR, false, false); 

                this._debug = false;

                callback();
            });
        };
        fr.readAsDataURL(file);
    }

}

