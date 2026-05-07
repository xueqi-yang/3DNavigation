import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Color} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {Pathfinding, PathfindingHelper} from "three-pathfinding";
import * as path from "path";
//import { objectGroup } from "three/examples/jsm/nodes/core/UniformGroupNode.js";
//import { func } from "three/examples/jsm/nodes/code/FunctionNode.js";


const scene = new THREE.Scene();
scene.background = new Color('grey');

// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const fov = 75 // field of view - how wide it is (how close to the camera)
const aspect = window.innerWidth / window.innerHeight
const near = 1.0
const far = 1000.0

// like a real camera
const perspectiveCamera = new THREE.PerspectiveCamera(fov, aspect, near, far)

const left = -100
const right = 100
const top = 100
const bottom = -100

// not like a real camera
// nothing scales by distance - objects on the back and in the far appear of the same size
const orthographicCamera = new THREE.OrthographicCamera(left, right, top, bottom)

const camera = perspectiveCamera
camera.position.set(0, 5, 7) // 75, 20, 0

scene.add(perspectiveCamera)
scene.add(orthographicCamera)


// ambient + directional light makes scene more natural
// for all objects in the scene
// no direction
scene.add( new THREE.AmbientLight( 0xffffff, 0.4 ) );

// in specific direction
// points fron light's position to a target
// can cast shadows
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(-10, 2, -1);
scene.add(light);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', function () {
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width/height
    camera.updateProjectionMatrix();
})

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = false; // true adds inertia (for smooth controlling)
controls.screenSpacePanning = true; // true - obj moves with mouse, false - only on the level of the camera
// controls.minDistance = 20;
controls.minDistance = 3;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2; // how far we can rotate object (left click)
controls.update();

// const agentHeight = 2;
// const agentRadius = 1;

const agentHeight = 0.5;
const agentRadius = 0.15;

const agent = new THREE.Mesh(new THREE.CylinderGeometry(agentRadius, agentRadius, agentHeight),
                             new THREE.MeshPhongMaterial({color: 'green'}))
agent.position.y = agentHeight / 2
const agentGroup = new THREE.Group();
agentGroup.add(agent)
// agentGroup.position.z = 2
// agentGroup.position.x = 0
// agentGroup.position.y = 1

agentGroup.position.z = -1
agentGroup.position.x = 0
agentGroup.position.y = 0

scene.add(agentGroup)


const gltfloader = new GLTFLoader();

const urlNavmeshGLB = 'glb/building_navmesh.gltf';

const urlsDoors = [
    'glb/door.glb',
    'glb/door2.glb',
    'glb/door3.glb',
];

urlsDoors.forEach(url => {
    gltfloader.load(url, (gltf) => {
        let object = gltf.scene;
        scene.add(object);
    }, undefined, (error) => {
        console.error(error);
    });
});

const urlsFloors = [
    'glb/building/floor1.glb',
    'glb/building/floor2.glb',
    'glb/building/floor3.glb',
    'glb/building/floor4.glb',
    'glb/building/floor5.glb',
];


let floor1
let floor2
let floor3
let floor4
let floor5
urlsFloors.forEach(url => {
    gltfloader.load(url, (gltf) => {
        let floor
        if (gltf.scene.getObjectByName("Floor1")) {
            floor1 = gltf.scene.getObjectByName("Floor1");
            floor = floor1
        } else if (gltf.scene.getObjectByName("Floor2")) {
            floor2 = gltf.scene.getObjectByName("Floor2");
            floor = floor2
        } else if (gltf.scene.getObjectByName("Floor3")) {
            floor3 = gltf.scene.getObjectByName("Floor3");
            floor = floor3
        } else if (gltf.scene.getObjectByName("Floor4")) {
            floor4 = gltf.scene.getObjectByName("Floor4");
            floor = floor4
        } else if (gltf.scene.getObjectByName("Floor5")) {
            floor5 = gltf.scene.getObjectByName("Floor5");
            floor = floor5
        }
        scene.add(floor);
        if (floor === floor1) {
            floor.material.opacity = 1;
        } else {
            floor.material.opacity = 0.7;
        }
        floor.material.transparent = true;
    }, undefined, (error) => {
        console.error(error);
    });
});

let door_coordinates = {
    "door1": new THREE.Vector3(-2.8050405761298927, 2.1136216852416756, -0.06086446907692),
    "door2": new THREE.Vector3(2.9064642030044134, 2.1136220260031022, -6.435141873951886),
    "door3": new THREE.Vector3(2.8842250480889082, 0.00648565998652928, -2.531122153463738)
}
let chosenDoor
////////////////////////////////////////////////////////// pathfinding
const pathfinding = new Pathfinding()
const ZONE = 'level1'
let navmesh;
let groupID
let navpath
const pathfindingHelper = new PathfindingHelper()

gltfloader.load( urlNavmeshGLB,  ( gltf ) => {
    let object = gltf.scene
    // scene.add( object);
    console.log('navmesh', object)
    object.traverse( (node) => {
        if (!navmesh && node.isObject3D && node.children && node.children.length > 0) {
            // navmesh = node
            navmesh = node.children[0]
            // scene.add( navmesh);
            pathfinding.setZoneData(ZONE, Pathfinding.createZone(navmesh.geometry))
        }
    })
}, undefined,  ( error ) => {
    console.error( error );
} );

scene.add(pathfindingHelper)
// console.log('scene children', scene.children)
const raycaster = new THREE.Raycaster()
const clickMouse = new THREE.Vector2()

function goByClick() {
    clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1
    clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(clickMouse, camera)
    const found = raycaster.intersectObjects(scene.children) // all intersection points within the 3d scene
    console.log('intersection points: ', found)
    console.log('intersection object name: ', found[0].object.name, found[0].point)
    if (found.length > 0) {
        console.log('intersection points with scene objects are found!')
        let target = found[0].point
        findPathTo(target)
    }
}

function goByAddress() {
    const selectedDoor = doorsInput.value;
    // console.log(event)
    let target
    // let doorID = event.target.id
    switch(selectedDoor) {
        case '1':
            target = door_coordinates.door1
            break;
        case '2':
            target = door_coordinates.door2
            break;
        case '3':
            target = door_coordinates.door3
            break;
        default:
            // clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1
            // clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1
            // raycaster.setFromCamera(clickMouse, camera)
            // const found = raycaster.intersectObjects(scene.children)
            // target = found[0]
            break;
    }
    findPathTo(target)
}

const crossCubeGeometryHorizontal = new THREE.BoxGeometry(1, 0.1, 0.4);
const crossCubeGeometryVertical = new THREE.BoxGeometry(0.1, 1, 0.4);

const crossMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

const crossLine1 = new THREE.Mesh(crossCubeGeometryHorizontal, crossMaterial);
const crossLine2 = new THREE.Mesh(crossCubeGeometryVertical, crossMaterial);

const cross = new THREE.Group();
cross.rotateX(Math.PI / 2);
cross.rotateZ(Math.PI / 4);
cross.rotateZ(Math.PI / 4);

function createPathWithCubes(path) {
    const cubeSize = 0.1;
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    if (pathfindingHelper._pathLine) {
        scene.remove(pathfindingHelper._pathLine);
        pathfindingHelper._pathLine = null;
    }

    path.forEach(point => {
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.copy(point);
        scene.add(cube);
    });
}


function findPathTo(target) {
    groupID = pathfinding.getGroup(ZONE, agentGroup.position)
    const closestNode = pathfinding.getClosestNode(agentGroup.position, ZONE, groupID)
    navpath = pathfinding.findPath(closestNode.centroid, target, ZONE, groupID)
    console.log('path',navpath)
    if (navpath) {
        pathfindingHelper.reset()
        pathfindingHelper.setPlayerPosition(agentGroup.position)
        pathfindingHelper.setTargetPosition(target)
        pathfindingHelper.setPath(navpath)

        cross.add(crossLine1);
        cross.add(crossLine2);
        scene.add(cross);
        cross.position.copy(target);
        pathfindingHelper._targetMarker.visible = false
        pathfindingHelper.targetMarker = cross;

        for (let i = 1; i < pathfindingHelper._pathMarker.children.length; i++) {
            pathfindingHelper._pathMarker.children[i].visible = false
        }

        pathfindingHelper._pathLineMaterial.color.r = 255
        pathfindingHelper._pathLineMaterial.color.g = 0
        pathfindingHelper._pathLineMaterial.color.b = 0

        console.log(pathfindingHelper)
    }
}

let goButton = document.getElementById("searchButton")
goButton.addEventListener('click', goByAddress);
let doorsInput = document.getElementById('doors');


function move(delta) {
    if (!navpath || navpath.length <= 0) return;

    let targetPosition = navpath[0];
    const distance = targetPosition.clone().sub(agentGroup.position)
    if (distance.lengthSq() > 0.5 * 0.05) {
        distance.normalize()
        agentGroup.position.add(distance.multiplyScalar(delta * 5));

        let direction = distance.clone().normalize();
        let angle = Math.atan2(direction.x, direction.z);
        agentGroup.rotation.y = angle;
    } else {
        navpath.shift();
    }

    let floors = [floor1, floor2, floor3, floor4, floor5]
    floors.forEach((floor) => {
        floor.material.opacity = 0.5;
    })
    if (agentGroup.position.y < 1) {
        floor1.material.opacity = 1;
    } else if (agentGroup.position.y < 4) {
        floor2.material.opacity = 1;
    } else if (agentGroup.position.y < 6) {
        floor3.material.opacity = 1;
    } else if (agentGroup.position.y < 8) {
        floor4.material.opacity = 1;
    } else if (agentGroup.position.y < 10) {
        floor5.material.opacity = 1;
    }
}

// function updateCamera() {
//     const offset = new THREE.Vector3(0, 5, -10); // Position behind the agent
//     const agentPosition = agentGroup.position.clone();
//     const cameraPosition = agentPosition.clone().add(offset);
//
//     camera.position.copy(cameraPosition);
//     camera.lookAt(agentGroup.position);
//
//     if (camera.position.y < agentGroup.position.y + agentHeight) {
//         camera.position.y = agentGroup.position.y + agentHeight;
//     }
// }

const clock = new THREE.Clock();
function animate() {
    move(clock.getDelta())
    // updateCamera()
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}

animate();
window.addEventListener('click', goByClick)
