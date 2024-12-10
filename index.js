import * as THREE from 'three';
import * as dat from 'dat.gui';
import {OrbitControls} from 'three/addons';
import {vertexShader, fragmentShader} from './src/shader.js';


let camera = null, camera2 = null, scene = null, renderer = null;
let controls = null;
let leftSide = null, rightSide = null;
let camRadius = null, camX = null, camZ = null;
let camToLeftSide = null, camToRightSide = null, camLookAt = null;
let tmp = new THREE.Vector3();

let fovDiv = document.getElementById('current-fov');

function degToRad(deg) {
    return deg * Math.PI / 180;
}

function radToDeg(rad) {
    return rad * 180 / Math.PI;
}

function verToHorFOV(fov) {
    return 2 * Math.atan( Math.tan( fov * Math.PI / 180 / 2 ) * ASPECT ) * 180 / Math.PI;
}

function horToVerFOV(fov) {
    return 2 * Math.atan( Math.tan( fov * Math.PI / 180 / 2 ) / ASPECT ) * 180 / Math.PI;
}


let leftSideHelper = null, rightSideHelper = null, camLookAtHelper = null;

function setupEventListeners() {
    const triggers = {
        'fov': FOV,
        'angle': ANGLE,
    }
    {
        const gui = new dat.GUI();
        const cameraFolder = gui.addFolder('Camera');
        cameraFolder.add(triggers, 'fov', 10, 90).onChange(function (value) {
            FOV = value;
            fovDiv.innerText = `FOV: ${FOV.toFixed(3)}`;
            camera.fov = FOV;
            camera.updateProjectionMatrix();
            camRadius = (HEIGHT / 2) / Math.tan(degToRad(FOV / 2));

            camX = -Math.cos(degToRad(ANGLE)) * camRadius;
            camZ = Math.sin(degToRad(ANGLE)) * camRadius;
            camera.position.set(camX, 0, camZ);
            
            camRotY = Math.acos(camLookAt.clone().dot(new THREE.Vector3(0, 0, -1)));
            camera.rotation.y = ANGLE > 90 ? camRotY : -camRotY;
        });
        cameraFolder.add(triggers, 'angle', 40, 140).onChange(function (value) {
            ANGLE = value;
            camX = -Math.cos(degToRad(ANGLE)) * camRadius;
            camZ = Math.sin(degToRad(ANGLE)) * camRadius;
            camera.position.set(camX, 0, camZ);

            camToLeftSide = tmp.subVectors(leftSide, camera.position).normalize().clone();
            camToRightSide = tmp.subVectors(rightSide, camera.position).normalize().clone();
            
            if (leftSideHelper === null) {
                leftSideHelper = new THREE.ArrowHelper(camToLeftSide, camera.position, 5, 0xff0000);
                scene.add(leftSideHelper);
            } else {
                leftSideHelper.position.copy(camera.position);
                leftSideHelper.setDirection(camToLeftSide);
            }
            if (rightSideHelper === null) {
                rightSideHelper = new THREE.ArrowHelper(camToRightSide, camera.position, 5, 0xff0000);
                scene.add(rightSideHelper);
            } else {
                rightSideHelper.position.copy(camera.position);
                rightSideHelper.setDirection(camToRightSide);
            }

            FOV = Math.acos(camToLeftSide.clone().dot(camToRightSide)); // NOTE: this is horizontal FOV, but perspective camera needs vertical FOV
            FOV = radToDeg(FOV);
            FOV = horToVerFOV(FOV);
            fovDiv.innerText = `FOV: ${FOV.toFixed(3)}`;
            camera.fov = FOV;
            camera.updateProjectionMatrix();

            camLookAt = tmp.addVectors(camToLeftSide, camToRightSide).divideScalar(2).normalize();

            if (camLookAtHelper === null) {
                camLookAtHelper = new THREE.ArrowHelper(camLookAt, camera.position, 5, 0xff0000);
                scene.add(camLookAtHelper);
            } else {
                camLookAtHelper.position.copy(camera.position);
                camLookAtHelper.setDirection(camLookAt);
            }

            // camera.lookAt(camLookAt.x, camLookAt.y, camLookAt.z);
            camRotY = Math.acos(camLookAt.clone().dot(new THREE.Vector3(0, 0, -1)));
            camera.rotation.y = ANGLE > 90 ? camRotY : -camRotY;
        });
        cameraFolder.open();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
            activeCamera = (activeCamera === camera) ? camera2 : camera;
        }
    })

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );
    })
}

let FOV = 70;
let ANGLE = 90;
let ASPECT = window.innerWidth / window.innerHeight;
let NEAR = 0.01, FAR = 1000;
let DEPTH = 5, HEIGHT = 2, WIDTH = HEIGHT * ASPECT;
let THICKNESS = 0.1;
let UNIT_LENGTH = 0.2;

let activeCamera = null;

function init() {
    // renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    let canvas_parent_div = document.querySelector('#canvas-container');
    canvas_parent_div.appendChild(renderer.domElement);

    // scene
    scene = new THREE.Scene();

    // camera
    fovDiv.innerText = `FOV: ${FOV}`;
    camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
    camRadius = (HEIGHT / 2) / Math.tan(degToRad(FOV / 2));
    camera.position.set(0, 0, camRadius); // assuming the mesh is placed at (0, 0, 0), for ease of rotating the camera around the origin on a spherical coords
    // console.log(camera.position);
    camera.lookAt(0, 0, 0);

    const helper = new THREE.CameraHelper(camera);
    scene.add( helper );

    activeCamera = camera;

    camera2 = new THREE.PerspectiveCamera(70, ASPECT, 0.01, 2000);
    camera2.position.set(2, 3, 3);
    camera2.lookAt(0, 0, 0);

    // lighting
    const light = new THREE.AmbientLight(0x404040, 10);
    scene.add(light);
    const light2 = new THREE.PointLight(0x404040, 100, 100);
    light2.position.set(1, 2.5, 5);
    scene.add(light2);

    // mesh
    let material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            divisions: {value: 10},
            aspect_ratio: {value: new THREE.Vector2(WIDTH / DEPTH, 1)},
            thickness: {value: 0.04},
        },
        side: THREE.DoubleSide
    });

    // let geo = new THREE.BoxGeometry(WIDTH, HEIGHT, DEPTH);
    // let mesh = new THREE.Mesh(geo, material);
    // scene.add(mesh);
    let group = new THREE.Group();
    group.position.set(0, 0, - DEPTH / 2);
    scene.add(group);

    leftSide = new THREE.Vector3(-WIDTH / 2, 0, 0);
    rightSide = new THREE.Vector3(WIDTH / 2, 0, 0);

    let bottomTopGeo = new THREE.PlaneGeometry(WIDTH, DEPTH, Math.floor(WIDTH / UNIT_LENGTH), Math.floor(DEPTH / UNIT_LENGTH));
    let bottomMesh = new THREE.Mesh(bottomTopGeo, material);
    bottomMesh.position.set(0, - HEIGHT / 2, 0);
    bottomMesh.rotation.x = Math.PI / 2;
    group.add(bottomMesh);

    let topMesh = new THREE.Mesh(bottomTopGeo, material);
    topMesh.position.set(0, HEIGHT / 2, 0);
    topMesh.rotation.x = Math.PI / 2;
    group.add(topMesh);

    let leftRightGeo = new THREE.PlaneGeometry(DEPTH, HEIGHT, Math.floor(DEPTH / UNIT_LENGTH), Math.floor(HEIGHT / UNIT_LENGTH));
    let leftMesh = new THREE.Mesh(leftRightGeo, material);
    leftMesh.position.set(- WIDTH / 2, 0, 0);
    leftMesh.rotation.y = Math.PI / 2;
    group.add(leftMesh);

    let rightMesh = new THREE.Mesh(leftRightGeo, material);
    rightMesh.position.set(WIDTH / 2, 0, 0);
    rightMesh.rotation.y = Math.PI / 2;
    group.add(rightMesh);

    let backGeo = new THREE.PlaneGeometry(WIDTH, HEIGHT, Math.floor(WIDTH / UNIT_LENGTH, HEIGHT / UNIT_LENGTH));
    let backMesh = new THREE.Mesh(backGeo, material);
    backMesh.position.set(0, 0, - DEPTH / 2);
    group.add(backMesh);

    // orbit control
    controls = new OrbitControls(camera2, renderer.domElement);
    controls.enableZoom = true;

    setupEventListeners();
}

function animate() {
    requestAnimationFrame(animate);

    renderer.render(scene, activeCamera);
}

init();
animate();