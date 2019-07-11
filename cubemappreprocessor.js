
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

        this._directions = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
        const promises = [];

        for (const direction of this._directions) {
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
        const element = $('#preprocess-canvas')[0];
        const canvas = new gloperate.Canvas(element, { antialias: false });
        const renderer = new CubemapPreprocessorRenderer(this.maps);

        canvas.renderer = renderer;
        renderer.controller = canvas.controller; 
    }
}

class CubemapPreprocessorRenderer extends gloperate.Renderer {
    constructor(cubemapData) {
        super();

        // TODO: find an elegant way to remove the duplication with CubemapProcessor
        this._directions = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

        this._cubemapSize = cubemapData.px.bitmap.height;
        this._cubemapData = cubemapData;

        this._program = undefined;
        this._ndcRectangle = null;
        this._cubemap = undefined;
        this._targetFBO = undefined;
        this._targetTexture = undefined;
        this._uFace = undefined;
        this._uRoughness = undefined;
    }

    onInitialize() {
        const gl = this._context.gl;

        const internalFormatAndType = gloperate.Wizard.queryInternalTextureFormat(
            this._context, gl.RGBA, gloperate.Wizard.Precision.byte);

        // TODO: allow HDR (float) cubemaps
        this._cubemap = new gloperate.TextureCube(this._context, 'Cubemap');
        this._cubemap.initialize(this._cubemapSize, internalFormatAndType[0], gl.RGBA, internalFormatAndType[1]);
        this._cubemap.data([gl.TEXTURE_CUBE_MAP_POSITIVE_X, this._cubemapData.px.bitmap.data]);
        this._cubemap.data([gl.TEXTURE_CUBE_MAP_POSITIVE_Y, this._cubemapData.py.bitmap.data]);
        this._cubemap.data([gl.TEXTURE_CUBE_MAP_POSITIVE_Z, this._cubemapData.pz.bitmap.data]);
        this._cubemap.data([gl.TEXTURE_CUBE_MAP_NEGATIVE_X, this._cubemapData.nx.bitmap.data]);
        this._cubemap.data([gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, this._cubemapData.ny.bitmap.data]);
        this._cubemap.data([gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, this._cubemapData.nz.bitmap.data]);

        this._ndcRectangle = new gloperate.NdcFillingRectangle(this._context, 'NdcFillingRectangle');
        this._ndcRectangle.initialize();

        // TODO: allow different size than input cubemap
        this._targetTexture = new gloperate.Texture2D(this._context, 'TargetTexture');
        this._targetTexture.initialize(this._cubemapSize, this._cubemapSize,
            internalFormatAndType[0], gl.RGBA, internalFormatAndType[1]);

        this._targetFBO = new gloperate.Framebuffer(this._context, 'TargetFBO');
        this._targetFBO.initialize([[this._context.gl2facade.COLOR_ATTACHMENT0, this._targetTexture] ]);      
        this._targetFBO.bind();

        const vert = new gloperate.Shader(this._context, gl.VERTEX_SHADER, 'ndc-rectangle (in-line)');
        vert.initialize(this.SHADER_SOURCE_VERT);

        const frag = new gloperate.Shader(this._context, gl.FRAGMENT_SHADER, 'transform (in-line)');
        frag.initialize(this.SHADER_SOURCE_FRAG);

        this._program = new gloperate.Program(this._context, 'TransformProgram');
        this._program.initialize([vert, frag], false);

        this._program.attribute('a_vertex', this._ndcRectangle.vertexLocation);
        this._program.link();       

        this._program.bind();
        gl.uniform1i(this._program.uniform('u_cubemap'), 0);

        this._uFace = this._program.uniform('u_face');
        this._uRoughness = this._program.uniform('u_roughness');

        return true;
    }

    onUpdate() {
        return true;
    }

    onPrepare() { }

    onSwap() { }

    onFrame() {
        const gl = this._context.gl;
        console.log('Preprocessing cubemap...');

        $('#preprocessed-images').empty();

        this._program.bind();
        this._cubemap.bind(gl.TEXTURE0);

        const numMips = Math.log2(this._cubemapSize);

        for (let mipLevel = 0; mipLevel < numMips; mipLevel++) {
            const targetSize = this._cubemapSize * Math.pow(0.5, mipLevel);
            this._targetTexture.resize(targetSize, targetSize);

            const roughness = mipLevel / (numMips - 1);
            console.log(`Processing size ${targetSize} at roughness ${roughness}`);

            gl.viewport(0, 0, targetSize, targetSize);
            gl.uniform1f(this._uRoughness, roughness);

            const container = jQuery('<div/>', {
                class: 'row'
            }).appendTo('#preprocessed-images')

            for (let face = 0; face < 6; face++) {
                gl.uniform1i(this._uFace, face);

                this._targetFBO.bind();

                this._ndcRectangle.bind();
                this._ndcRectangle.draw();
                this._ndcRectangle.unbind();

                const rgba = new Uint8Array(targetSize * targetSize * 4);
                gl.readPixels(0, 0, targetSize, targetSize, gl.RGBA, gl.UNSIGNED_BYTE, rgba);

                this.addImageToDOM(container, targetSize, rgba, this._directions[face], mipLevel);
            }
        }
    }

    addImageToDOM(parent, size, data, direction, mipLevel) {
        const image = new jimp(size, size);  
        image.bitmap.data = data;

        let buffer = null;
        image.getBuffer('image/png', (error, result) => buffer = result);
        
        const blob = new Blob([buffer], {type: 'image/png'});
        const url = window.URL.createObjectURL(blob);
        
        const div = jQuery('<div/>', {
            class: 'col'
        });

        const a = jQuery('<a/>', {
            href: url,
            download: `preprocessed-map-${direction}-${mipLevel}.png`
        });

        const img = jQuery('<img/>', {
            'class': 'w-100 img-fluid rounded',
            src: url,
        }).css('image-rendering', 'crisp-edges');
        
        div.appendTo(parent);
        a.appendTo(div);
        img.appendTo(a);

        // img.attr('src', url); 
        // img.parent().attr('href', url);
    }
}

CubemapPreprocessorRenderer.prototype.SHADER_SOURCE_VERT = `
precision highp float;
precision highp int;

#if __VERSION__ == 100
    attribute vec2 a_vertex;
#else
    in vec2 a_vertex;
    #define varying out
#endif

varying vec2 v_uv;

void main(void)
{
    vec2 v = a_vertex;
    v_uv = a_vertex;
    
    gl_Position = vec4(a_vertex.xy, 0.0, 1.0);
}
`;


CubemapPreprocessorRenderer.prototype.SHADER_SOURCE_FRAG = `
precision highp float;
precision highp int;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
    #define texture texture2D
#else
    layout(location = 0) out vec4 fragColor;
    #define varying in
#endif

uniform int u_face;
uniform float u_roughness;

uniform samplerCube u_cubemap;

varying vec2 v_uv;

const float PI         = 3.1415926535897932384626433832795;
const uint SAMPLE_COUNT = 512u;

const vec3 o = vec3(0.0, 1.0,-1.0); // orientation transform helper

vec3 ray(in vec3 ray, in int face) {

         if(face == 0) return ray.zyx * o.yzz; // px
    else if(face == 1) return ray.zyx * o.zzy; // nx
    else if(face == 2) return ray.xzy * o.yyy; // py
    else if(face == 3) return ray.xzy * o.yzz; // ny
    else if(face == 4) return ray.xyz * o.yzy; // pz
                       return ray.xyz * o.zzz; // nz    
}

vec3 cubeTransform(in vec2 uv, in int face) {
    return ray(normalize(vec3(uv, 1.0)), face);    
}

// https://learnopengl.com/PBR/IBL/Specular-IBL
float RadicalInverse_VdC(uint bits) 
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

// https://learnopengl.com/PBR/IBL/Specular-IBL
vec2 Hammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}

// https://learnopengl.com/PBR/IBL/Specular-IBL
vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
{
    float a = roughness*roughness;
    
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
    
    // from spherical coordinates to cartesian coordinates
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;
    
    // from tangent-space vector to world-space sample vector
    vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent   = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);
    
    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}

void main(void)
{
    vec3 ray = cubeTransform(v_uv, u_face);
    vec3 N = ray;
    vec3 R = N;
    vec3 V = R;

    float totalWeight = 0.0;   
    vec3 prefilteredColor = vec3(0.0);     
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H  = ImportanceSampleGGX(Xi, N, u_roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0)
        {
            prefilteredColor += texture(u_cubemap, L).rgb * NdotL;
            totalWeight += NdotL;
        }
    }
    prefilteredColor = prefilteredColor / totalWeight;

    fragColor = vec4(prefilteredColor, 1.0);
}
`;
