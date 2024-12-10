export const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }
`;

export const fragmentShader = `
    varying vec2 vUv;
    uniform vec2 aspect_ratio;
    uniform float divisions;
    uniform float thickness;

    void main() {
        vec2 uv = fract(vUv * divisions);

        vec3 col = vec3(0.);

        float d = (uv.x < thickness || uv.x > 1. - thickness || uv.y < thickness || uv.y > 1. - thickness) ? 1. : 0.;

        col += d * vec3(1.);

        gl_FragColor = vec4(col, 1.);
    }
`;