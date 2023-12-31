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
  cameraRotation: 0,
};

init();
animate();
var rot = 0;
var globaltex;
var curves;
var texData;

//using values from the ASM's as offset from color...need to figure out an algorithm from ECD value to color
//offset value is considered offset from hole depth (or last survey depth I suppose)
var ASMs: [number, number][] = [
  [-100, 1],
  [-500, 255],
  [-800, 10],
  [-2000, 255],
  [-3000, 20],
  [-3800, 240],
];

function updateData() {
  if (curves == undefined || curves.getLength() == undefined) {
    console.log('curves not there yet');
    return;
  }

  //reset data again...just to get rid of funny business when the bit is moving
  var size = curves.getLength();
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    // set r, g, b, and alpha data values
    //set to gray for default
    texData[stride] = 192; // red
    texData[stride + 1] = 192; // green
    texData[stride + 2] = 192; // blue
    texData[stride + 3] = 255; // alpha
  }

  for (
    let j = ASMs.length - 1;
    j > 0;
    j-- // only go to 1 because we look at the value before to create a gradient.
  ) {
    var startIndex = curves.getLength() + ASMs[j][0];
    var endIndex = curves.getLength() + ASMs[j - 1][0];

    var step = (ASMs[j - 1][1] - ASMs[j][1]) / (endIndex - startIndex);
    var currvalue = ASMs[j][1];

    for (let i = Math.floor(startIndex); i < Math.floor(endIndex); i++) {
      var arrPos = i * 4;
      //console.log(currvalue);
      texData[arrPos] = 255 - currvalue; // red
      texData[arrPos + 1] = currvalue; // green
      texData[arrPos + 2] = 0; // blue
      texData[arrPos + 3] = 255; // alpha
      currvalue += step;
    }
  }
}

function createTexture(curves) {
  var width = curves.getLength(),
    height = 1;
  var size = width * height;
  texData = new Uint8Array(4 * size);
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    // set r, g, b, and alpha data values
    //set to gray for default
    texData[stride] = 192; // red
    texData[stride + 1] = 192; // green
    texData[stride + 2] = 192; // blue
    texData[stride + 3] = 255; // alpha
  }
  //  console.log(texData);
  var texture = new THREE.DataTexture(texData, width, height);

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

  curves = new THREE.CurvePath();

  getSurveyData()
    .then((s) => {
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
    })
    .catch((err) => {
      console.log("failed to get curve...just make something up")
      var points = [
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.25, 0.32, 92.96),
        new THREE.Vector3(-0.14, 0.87, 154.53),
        new THREE.Vector3(-0.29, 0.96, 165.49),
        new THREE.Vector3(-0.38, 1.03, 172.2),
        new THREE.Vector3(-0.72, 1.3, 190.18),
        new THREE.Vector3(-1.08, 1.64, 210.15),
        new THREE.Vector3(-1.22, 1.79, 218.82),
        new THREE.Vector3(-1.7, 2.27, 246.55),
        new THREE.Vector3(-1.8, 2.35, 254.47),
        new THREE.Vector3(-2.04, 2.52, 274.29),
        new THREE.Vector3(-2.47, 2.88, 301.1),
        new THREE.Vector3(-2.88, 3.21, 328.53),
        new THREE.Vector3(-3.04, 3.3, 342.45),
        new THREE.Vector3(-3.22, 3.39, 356.26),
        new THREE.Vector3(-3.87, 3.69, 383.69),
        new THREE.Vector3(-5.09, 4.11, 411.7),
        new THREE.Vector3(-6.93, 4.72, 438.75),
        new THREE.Vector3(-9.32, 5.65, 466.07),
        new THREE.Vector3(-12.12, 6.87, 493.33),
        new THREE.Vector3(-15.31, 8.38, 520.53),
        new THREE.Vector3(-18.75, 10.08, 548.0),
        new THREE.Vector3(-22.15, 11.81, 575.47),
        new THREE.Vector3(-25.62, 13.51, 602.63),
        new THREE.Vector3(-29.43, 15.29, 630.97),
        new THREE.Vector3(-33.32, 17.13, 659.61),
        new THREE.Vector3(-37.24, 18.81, 687.94),
        new THREE.Vector3(-41.2, 20.36, 716.27),
        new THREE.Vector3(-45.08, 21.86, 744.62),
        new THREE.Vector3(-48.92, 23.27, 772.98),
        new THREE.Vector3(-52.62, 24.81, 801.35),
        new THREE.Vector3(-56.17, 26.57, 829.72),
        new THREE.Vector3(-59.9, 28.4, 858.38),
        new THREE.Vector3(-63.54, 30.02, 886.75),
        new THREE.Vector3(-64.69, 30.48, 896.12),
      ];

      var first = points[0];
      for (let i = 1; i < points.length; i++) {
        var second = points[i];
        var linecurve = new THREE.LineCurve3(first, second);
        first = second;
        curves.add(linecurve);
      }
    })
    .then(drawTube);

  function drawTube() {
    console.log(curves.getLength());
    var tube = new THREE.TubeGeometry(curves, 20, 5, 20, false);

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
    if (aspect < 1) {
      frustumHeight = 2 * bbox_radius;
    } else {
      frustumHeight = (2 * bbox_radius) / aspect;
    }
    camera.left = (-frustumHeight * aspect) / 2;
    camera.right = (frustumHeight * aspect) / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;
    camera.updateProjectionMatrix();
    updateData();

    updateCam();
  }

  function makeData() {
    var depthchange = Math.random() * 20; // change up to 20ft in a second?
    var depthdirectionchange = Math.random() < 0.5 ? -1 : 1;

    for (let i = 0; i < ASMs.length; i++) {
      ASMs[i][0] += depthchange * depthdirectionchange;
      //ASMs[i][1] = (depthdirectionchange > 0)? 255 : 0
      ASMs[i][1] = Math.random() * 255;
    }
    //console.log(ASMs);
    updateData();

    renderer.copyTextureToTexture(new THREE.Vector2(), globaltex, globaltex);
  }

  setInterval(makeData, 1000);

  initGui();
}

function updateCam() {
  camera.position.x = Math.floor(API.cameraX);
  camera.position.y = Math.floor(API.cameraY);
  camera.position.z = Math.floor(API.cameraZ);

  camera.lookAt(
    new THREE.Vector3(
      Math.floor(API.cameraLookX),
      Math.floor(API.cameraLookY),
      Math.floor(API.cameraLookZ)
    )
  );
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
    .add(API, 'cameraRotation', -Math.PI * 2.0, Math.PI * 2.0)
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

var lastUpdate = Date.now();
function animate() {
  requestAnimationFrame(animate);

  // if (Date.now() - lastUpdate > 1000 )
  // {
  //   updateData(Math.random() < 0.5 ? -1 : 1, globaltex);
  //   renderer.copyTextureToTexture(new THREE.Vector2(), globaltex, globaltex);
  //   lastUpdate = Date.now();
  // }

  if (useControls) controls.update();
  renderer.render(scene, camera);
}
