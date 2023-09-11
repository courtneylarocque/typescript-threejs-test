import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, controls;
let gui;
let mesh;
let useControls = false;

const API = {
  offsetX: 0,
  offsetY: 0,
  repeatX: 1,
  repeatY: 1,
  rotation: 0, // positive is counterclockwise
  centerX: 0.5,
  centerY: 0.5,
  cameraX: 10000,
  cameraY: 1200,
  cameraZ: 1350.0,
  cameraLookX: 4200.0,
  cameraLookY: 0.0,
  cameraLookZ: 1350.0,
  cameraRotation : 0,
};

init();
animate();
var rot = 0;
var globaltex;

function createTexture(curves) {
  var width = curves.getLength(),
    height = 1;
  var size = width * height;
  var data = new Uint8Array(4 * size);
  for (let i = 0; i < size; i++) {
    const stride = i * 4,
      a1 = i / size,
      a2 = (i % width) / width;
    // set r, g, b, and alpha data values
    data[stride] = Math.floor(255 * a1); // red
    data[stride + 1] = 255 - Math.floor(255 * a1); // green
    data[stride + 2] = 0; // blue
    data[stride + 3] = 255; // alpha
  }
  console.log(data);
  var texture = new THREE.DataTexture(data, width, height);

  //texture = new THREE.TextureLoader().load("./textures/uv_grid_opengl.jpg");

  texture.repeat.set(1, 1);
  //texture.rotation =  0;
  texture.needsUpdate = true;

  return texture;
}

function init() {
  const info = document.createElement('div');
  info.style.position = 'absolute';
  info.style.top = '10px';
  info.style.width = '100%';
  info.style.color = '#fff';
  info.style.link = '#f80';
  document.body.appendChild(info);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // camera = new THREE.PerspectiveCamera(
  //   75,
  //   window.innerWidth / window.innerHeight,
  //   0.1,
  //   1000
  // );
  // camera.position.set(0, 200, 0);
  // // camera.lookAt(new THREE.Vector3(0, 0, 0).applyQuaternion(camera.quaternion));

  var frustumHeight = 100;
  var aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    (-frustumHeight * aspect) / 2,
    (frustumHeight * aspect) / 2,
    frustumHeight / 2,
    -frustumHeight / 2,
    -10000000,
    10000000
  );
  camera.position.x = 0;
  camera.position.y = 1220;
  camera.position.z = 1350;

  if (useControls) {
    controls = new OrbitControls(camera, renderer.domElement);
    // controls.minDistance = -1000;
    // controls.maxDistance = 50;
  }

  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  scene.add(new THREE.AmbientLight(0x666666));

  const light = new THREE.PointLight(0xffffff, 3, 0, 0);
  light.position.copy(camera.position);
  scene.add(light);

  var curves = new THREE.CurvePath();

  getSurveyData().then((s) => {
    var first = new THREE.Vector3(
      s.surveys[0].displacementNorthSouth.value,
      s.surveys[0].displacementEastWest.value,
      s.surveys[0].trueVerticalDepth.value
    );
    for (let i = 1; i < s.surveys.length; i++) {
      var second = new THREE.Vector3(
        s.surveys[i].displacementNorthSouth.value,
        s.surveys[i].displacementEastWest.value,
        s.surveys[i].trueVerticalDepth.value
      );

      var linecurve = new THREE.LineCurve3(first, second);
      first = second;
      curves.add(linecurve);
    }
    console.log(curves.getLength());
    var tube = new THREE.TubeGeometry(curves, 20, 3, 20, false);

    globaltex = createTexture(curves);

    mesh = new THREE.Mesh(
      tube,
      new THREE.MeshBasicMaterial({
        map: globaltex,
        side: THREE.DoubleSide,
      })
    );

    scene.add(mesh);

  // BOUNDING BOX
  var helper_bbox = new THREE.BoxHelper(mesh);
  helper_bbox.update();
  // scene.add(helper_bbox);

  // FIT ALL:
  var bbox_radius = helper_bbox.geometry.boundingSphere.radius;
  if(aspect < 1){
    frustumHeight = 2 * bbox_radius;
  }
  else{
    frustumHeight = 2 * bbox_radius / aspect;
  }
  camera.left = - frustumHeight * aspect / 2;
  camera.right = frustumHeight * aspect / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = - frustumHeight / 2;
  camera.updateProjectionMatrix();
  
  updateCam();

  });

  initGui();
}

function updateCam()
{
  camera.position.x = Math.floor(API.cameraX);
  camera.position.y = Math.floor(API.cameraY);
  camera.position.z = Math.floor(API.cameraZ);

  camera.lookAt(new THREE.Vector3(Math.floor(API.cameraLookX), Math.floor(API.cameraLookY), Math.floor(API.cameraLookZ)));
  camera.rotation.z = API.cameraRotation;
}

function updateUvTransform() {
  const texture = mesh.material.map;

  if (texture.matrixAutoUpdate === true) {
    texture.offset.set(API.offsetX, API.offsetY);
    texture.repeat.set(API.repeatX, API.repeatY);
    texture.center.set(API.centerX, API.centerY);
    texture.rotation = API.rotation; // rotation is around center
  } else {
    // setting the matrix uv transform directly
    //texture.matrix.setUvTransform( API.offsetX, API.offsetY, API.repeatX, API.repeatY, API.rotation, API.centerX, API.centerY );

    // another way...
    texture.matrix
      .identity()
      .translate(-API.centerX, -API.centerY)
      .rotate(API.rotation) // I don't understand how rotation can preceed scale, but it seems to be required...
      .scale(API.repeatX, API.repeatY)
      .translate(API.centerX, API.centerY)
      .translate(API.offsetX, API.offsetY);
  }

  updateCam();
  
  render();
}

function render() {
  renderer.render(scene, camera);
}

function initGui() {
  gui = new GUI();

  gui
    .add(API, 'offsetX', 0.0, 4000.0)
    .name('offset.x')
    .onChange(updateUvTransform);
  gui
    .add(API, 'offsetY', 0.0, 4000.0)
    .name('offset.y')
    .onChange(updateUvTransform);
  gui.add(API, 'repeatX', 0, 2.0).name('repeat.x').onChange(updateUvTransform);
  gui.add(API, 'repeatY', 0, 2.0).name('repeat.y').onChange(updateUvTransform);
  gui
    .add(API, 'rotation', -Math.PI * 2.0, Math.PI * 2.0)
    .name('rotation')
    .onChange(updateUvTransform);
  gui
    .add(API, 'centerX', 0.0, 4000.0)
    .name('center.x')
    .onChange(updateUvTransform);
    gui
    .add(API, 'centerY', 0.0, 4000.0)
    .name('center.y')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraX', -10000.0, 10000.0)
    .name('camera.x')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraY', -100000.0, 100000.0)
    .name('camera.y')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraZ', -10000.0, 10000.0)
    .name('camera.z')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraLookX', -10000.0, 10000.0)
    .name('camera.Look.x')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraLookY', -10000.0, 10000.0)
    .name('camera.Look.y')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraLookZ', -10000.0, 10000.0)
    .name('camera.Look.z')
    .onChange(updateUvTransform);
    gui
    .add(API, 'cameraRotation', -Math.PI *2.0 , Math.PI *2.0)
    .name('camera.rotate.z')
    .onChange(updateUvTransform);
}

interface UnitV1 {
  id: string;
  name: string;
  abbreviation: string;
}

interface DataValueV1 {
  value?: number;
  unit?: UnitV1;
}

type SurveyStatusV1 = 'Unapproved' | 'Approved';

const SurveyStatusV1 = {
  Unapproved: 'Unapproved' as SurveyStatusV1,
  Approved: 'Approved' as SurveyStatusV1,
};

type SurveyToolTypeV1 =
  | 'NotSet'
  | 'MagMWD'
  | 'GyroMWD'
  | 'GyroNorthSeeking'
  | 'GyroInertial'
  | 'MagSingleShot'
  | 'MagMultiShot'
  | 'Undefined';

const SurveyToolTypeV1 = {
  NotSet: 'NotSet' as SurveyToolTypeV1,
  MagMwd: 'MagMWD' as SurveyToolTypeV1,
  GyroMwd: 'GyroMWD' as SurveyToolTypeV1,
  GyroNorthSeeking: 'GyroNorthSeeking' as SurveyToolTypeV1,
  GyroInertial: 'GyroInertial' as SurveyToolTypeV1,
  MagSingleShot: 'MagSingleShot' as SurveyToolTypeV1,
  MagMultiShot: 'MagMultiShot' as SurveyToolTypeV1,
  Undefined: 'Undefined' as SurveyToolTypeV1,
};

type TVDCalculationStateV1 = 'None' | 'Survey' | 'Derived' | 'Projected';

const TVDCalculationStateV1 = {
  None: 'None' as TVDCalculationStateV1,
  Survey: 'Survey' as TVDCalculationStateV1,
  Derived: 'Derived' as TVDCalculationStateV1,
  Projected: 'Projected' as TVDCalculationStateV1,
};

type TVDSurveySourceTypeV1 =
  | 'Unspecified'
  | 'WITS'
  | 'LAS'
  | 'Manual'
  | 'CSV'
  | 'WITSML'
  | 'Auto'
  | 'Excel';

const TVDSurveySourceTypeV1 = {
  Unspecified: 'Unspecified' as TVDSurveySourceTypeV1,
  Wits: 'WITS' as TVDSurveySourceTypeV1,
  Las: 'LAS' as TVDSurveySourceTypeV1,
  Manual: 'Manual' as TVDSurveySourceTypeV1,
  Csv: 'CSV' as TVDSurveySourceTypeV1,
  Witsml: 'WITSML' as TVDSurveySourceTypeV1,
  Auto: 'Auto' as TVDSurveySourceTypeV1,
  Excel: 'Excel' as TVDSurveySourceTypeV1,
};

interface SurveyV1 {
  id?: string;
  surveyDepth?: DataValueV1;
  inclination?: DataValueV1;
  azimuth?: DataValueV1;
  trueVerticalDepth?: DataValueV1;
  displacementNorthSouth?: DataValueV1;
  displacementEastWest?: DataValueV1;
  doglegSeverity?: DataValueV1;
  surveyStatus?: SurveyStatusV1;
  timestamp?: string;
  trajectoryToolUsed?: SurveyToolTypeV1;
  tvdCalculationState?: TVDCalculationStateV1;
  tvdSurveySourceType?: TVDSurveySourceTypeV1;
}

interface SurveyByJobV1Response {
  surveys?: Array<SurveyV1>;
}

function getSurveyData(): Promise<SurveyByJobV1Response> {
  // API call will go here.
  return fetch(
    'https://data.qa1.welldata.net/api/v1/jobs/qa2_19482/data/surveys?status=Approved&errorInfo=true',
    {
      headers: {
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        token:
          "{ ApplicationID: 'DA9814EC-A54D-4021-94A3-3A489E96625C', SAML: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIwb2FnaHBxaWhiblRYblF0djFkNiIsImV4cCI6MTc5MTgzNDc4MywianRpIjoiSUQuTUowLW9XQnF4cWxGa2U5ZVZTZnF0Q0F1V01TVzQzakxTbkhwU1VLbmlSOCIsImlhdCI6MTYzNDE1NDc4MywiaXNzIjoiaHR0cHM6Ly9sb2dpbmRldi5ub3YuY29tL29hdXRoMi9hdXMxZG02d2RyTWNONG9xbDFkNyIsInN1YiI6ImJmYTFmNzY4MzAwMzRkNjNiMjE5NzdjOWFjMjdlZmVkIiwiZW1haWwiOiJDb3VydG5leS5MYXJvY3F1ZUBub3YuY29tIiwiZmlyc3ROYW1lIjoiQ291cnRuZXkiLCJsYXN0TmFtZSI6Ikxhcm9jcXVlIiwiYXR0ciI6eyJFbWFpbEFkZHJlc3MiOlsiQ291cnRuZXkuTGFyb2NxdWVAbm92LmNvbSJdLCJGaXJzdE5hbWUiOlsiQ291cnRuZXkiXSwiSXBBZGRyZXNzIjpbIiJdLCJMYXN0TmFtZSI6WyJMYXJvY3F1ZSJdfX0.Lxvc_FPD8fK3mnPxgSdXtOa4byJA8t-q68LEihtjwf0z6w6bF4QEAJnXmw_XtZMTbOJVMl52Hc_OwX8YvaFoFh9ICAs9btLYovcUZNBVm27fpNRDES7YmGqFVUHyT9n9p4q_ge2jEI6CR6X5tGGu6FNod019lhMP_QRHVV-njEgNLKSKhq35U5BJofQYb3kyOpaTPk6vrnYhY_1yRBur2pCN3XiOuUhXH2678PBSd95SKA7pnANxZmTlMrHIoR07vDGVsaxoc70WN6R29XmIPw6a_rXzDNAmDlKYadPeO7alngP4wm6_JqyA7cjpCtAVrVzwKmdqYmrut_pxz8P3Jw' }",
      },
      method: 'GET',
    }
  )
    .then((response) => response.json()) // Parse the response in JSON
    .then((response) => {
      return response as SurveyByJobV1Response; // Cast the response type to our interface
    });
}

function animate() {
  requestAnimationFrame(animate);

  if (useControls) controls.update();
  renderer.render(scene, camera);
}
