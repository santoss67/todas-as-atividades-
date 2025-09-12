// game.js (versão corrigida)
// -------------------------
// CONFIGURAÇÕES E ASSETS
// -------------------------
const ASSETS = {
  ambient: 'ambient.mp3',
  engine: 'engine.mp3',
  crash: 'crash.mp3' // <--- corrigi aqui: antes não existia
};

let scene, camera, renderer, clock;
let player, roadGroup, obstacles = [];
let speed = 0, maxSpeed = 2.8, accel = 0.02, decel = 0.04;
let laneX = 0;
let score = 0;
let gameRunning = false;
let ambientAudio, engineAudio, crashAudio;

// Referências ao DOM (serão setadas após DOMContentLoaded)
let container, overlay, startBtn, scoreEl, speedEl, gameoverEl, finalScoreEl, restartBtn;

// Inicialização (aguarda DOM pronto)
document.addEventListener('DOMContentLoaded', () => {
  // pegar elementos do DOM aqui para evitar nulls se o script estiver no <head>
  container = document.getElementById('container');
  overlay = document.getElementById('overlay');
  startBtn = document.getElementById('startBtn');
  scoreEl = document.getElementById('score');
  speedEl = document.getElementById('speed');
  gameoverEl = document.getElementById('gameover');
  finalScoreEl = document.getElementById('finalScore');
  restartBtn = document.getElementById('restartBtn');

  // ligar eventos dos botões de forma segura
  if (startBtn) startBtn.addEventListener('click', ()=>{ startGame(); });
  if (restartBtn) restartBtn.addEventListener('click', ()=>{ restartGame(); });

  // só inicializa a cena se o container existir
  if (!container) {
    console.error('Elemento #container não encontrado. Coloque um <div id="container"></div> no HTML.');
    return;
  }

  init();
});

// restante do código - scene, camera, etc.
function init(){
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fd3ff, 20, 140);

  const w = container.clientWidth, h = container.clientHeight;
  camera = new THREE.PerspectiveCamera(60, w/h, 0.1, 1000);
  camera.position.set(0, 6, -12);
  camera.lookAt(0, 0, 10);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5,10,-5);
  scene.add(dir);

  createRoad();
  createPlayerCar();

  window.addEventListener('resize', onResize);
  setupTouchControls();
  prepareAudio();
}

function onResize(){
  if (!container) return;
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}

// Estrada
function createRoad(){
  roadGroup = new THREE.Group();
  const roadGeo = new THREE.PlaneGeometry(12, 400);
  const roadMat = new THREE.MeshStandardMaterial({color:0x3f3f3f});
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI/2;
  road.position.z = 150/2 - 10;
  scene.add(road);

  const sideGeo = new THREE.PlaneGeometry(30, 400);
  const sideMat = new THREE.MeshStandardMaterial({color:0x6fb06f});
  const left = new THREE.Mesh(sideGeo, sideMat);
  left.rotation.x = -Math.PI/2;
  left.position.set(-21,0,150/2-10);
  scene.add(left);
  const right = left.clone(); right.position.x = 21; scene.add(right);

  const dashMat = new THREE.MeshStandardMaterial({color:0xfff176});
  for(let i=0;i<60;i++){
    const seg = new THREE.BoxGeometry(0.4,0.1,4);
    const m = new THREE.Mesh(seg, dashMat);
    m.position.set(0,0.05,i*6 - 40);
    scene.add(m);
  }

  const poleMat = new THREE.MeshStandardMaterial({color:0x222222});
  for(let i=0;i<18;i++){
    const p = new THREE.CylinderGeometry(0.08,0.08,2,6);
    const m1 = new THREE.Mesh(p, poleMat); m1.position.set(-11,1,i*22 - 40); scene.add(m1);
    const m2 = m1.clone(); m2.position.x = 11; scene.add(m2);
  }
}

// Carro
function createPlayerCar(){
  const car = new THREE.Group();
  const body = new THREE.BoxGeometry(1.6,0.5,3);
  const bodyMat = new THREE.MeshStandardMaterial({color:0xff2d6f, metalness:0.3, roughness:0.5});
  const bodyMesh = new THREE.Mesh(body, bodyMat); bodyMesh.position.y = 0.5; car.add(bodyMesh);

  const cabin = new THREE.BoxGeometry(1.2,0.35,1.2);
  const cabinMat = new THREE.MeshStandardMaterial({color:0x222, metalness:0.2});
  const cabinMesh = new THREE.Mesh(cabin, cabinMat); cabinMesh.position.set(0,0.8,-0.1); car.add(cabinMesh);

  const wheelGeo = new THREE.CylinderGeometry(0.28,0.28,0.4,12);
  const wheelMat = new THREE.MeshStandardMaterial({color:0x111});
  const positions = [[-0.7,0.25,1.05],[0.7,0.25,1.05],[-0.7,0.25,-1.05],[0.7,0.25,-1.05]];
  positions.forEach(p=>{ const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI/2; w.position.set(...p); car.add(w); });

  car.position.set(0,0,0);
  player = car;
  scene.add(player);

  camera.position.set(0,5,-12);
}

// Obstáculos
function spawnObstacle(zPos){
  const type = Math.random() < 0.5 ? 'cone' : 'box';
  let mesh;
  if(type === 'cone'){
    const geo = new THREE.ConeGeometry(0.45,0.9,8);
    const mat = new THREE.MeshStandardMaterial({color:0xffa726});
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.45;
  } else {
    const geo = new THREE.BoxGeometry(1.2,1.2,1.2);
    const mat = new THREE.MeshStandardMaterial({color:0x8d6e63});
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.6;
  }
  const lane = (Math.floor(Math.random()*5)-2) * 2.2;
  mesh.position.x = lane;
  mesh.position.z = zPos;
  scene.add(mesh);
  obstacles.push(mesh);
}

// Controles
// Controles - teclas de direção corrigidas
const keys = { left: false, right: false, up: false, down: false };

window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault(); // impede scroll da página
  }
  if (e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.key === 'ArrowUp') keys.up = true;
  if (e.key === 'ArrowDown') keys.down = true;
});

window.addEventListener('keyup', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === 'ArrowUp') keys.up = false;
  if (e.key === 'ArrowDown') keys.down = false;
});


// Áudio
function prepareAudio(){
  // cria apenas se ASSETS existir
  try {
    ambientAudio = new Audio(ASSETS.ambient);
    ambientAudio.loop = true; ambientAudio.volume = 0.6;
    engineAudio = new Audio(ASSETS.engine);
    engineAudio.loop = true; engineAudio.volume = 0.45;
    // ASSETS.crash agora existe; se arquivo faltar, catch() protegerá
    crashAudio = new Audio(ASSETS.crash); crashAudio.volume = 0.9;
  } catch (err) {
    console.warn('Erro ao carregar audio:', err);
  }
}
function startAudio(){
  if (ambientAudio){ ambientAudio.currentTime = 0; ambientAudio.play().catch(()=>{}); }
  if (engineAudio){ engineAudio.currentTime = 0; engineAudio.play().catch(()=>{}); }
}
function stopAudio(){ if (ambientAudio) ambientAudio.pause(); if (engineAudio) engineAudio.pause(); }

// Lógica do jogo
function startGame(){
  score = 0; speed = 0; gameRunning = true;
  obstacles.forEach(o=>scene.remove(o)); obstacles = [];
  if (overlay) overlay.style.display = 'none';
  if (gameoverEl) gameoverEl.style.display = 'none';
  for(let i=20;i<260;i+=12){ if(Math.random() < 0.4) spawnObstacle(i); }
  startAudio(); clock.start(); animate();
}
function endGame(){
  gameRunning = false; stopAudio();
  if (crashAudio) crashAudio.play().catch(()=>{});
  if (finalScoreEl) finalScoreEl.innerText = 'Pontos: ' + Math.floor(score);
  if (gameoverEl) gameoverEl.style.display = 'block';
}
function restartGame(){
  obstacles.forEach(o=>scene.remove(o)); obstacles = [];
  startGame();
}

function checkCollisions(){
  const playerBox = new THREE.Box3().setFromObject(player);
  for(let i=0;i<obstacles.length;i++){
    const ob = obstacles[i];
    const box = new THREE.Box3().setFromObject(ob);
    if(playerBox.intersectsBox(box)) return true;
  }
  return false;
}

function animate(){
  if(!gameRunning) return;
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if(keys.up){ speed += accel; } else { speed -= decel * 0.4; }
  if(keys.down){ speed -= decel * 1.2; }
  speed = Math.max(0, Math.min(maxSpeed, speed));

  if (keys.left) laneX += 0.25 + speed * 0.03;
if (keys.right) laneX -= 0.25 + speed * 0.03;
  laneX = Math.max(-4.8, Math.min(4.8, laneX));

  player.position.x += (laneX - player.position.x) * 0.25;
  player.position.z += 0.02;

  camera.position.lerp(new THREE.Vector3(player.position.x, 5, player.position.z - 12), 0.12);
  camera.lookAt(player.position.x, 0.8, player.position.z + 6);

  for(let i=0;i<obstacles.length;i++){
    const ob = obstacles[i];
    ob.position.z -= (0.4 + speed*1.2);
    if(ob.position.z < player.position.z - 30){ scene.remove(ob); obstacles.splice(i,1); i--; }
  }

  if(Math.random() < 0.025 + speed*0.01){ spawnObstacle(player.position.z + 200); }

  score += (0.3 + speed*0.45) * dt * 60;
  if (scoreEl) scoreEl.innerText = 'Pontos: ' + Math.floor(score);
  if (speedEl) speedEl.innerText = 'Velocidade: ' + Math.round(speed*50) + ' km/h';

  player.rotation.y = (laneX - player.position.x) * -0.08;

  if(checkCollisions()){ endGame(); return; }

  renderer.render(scene, camera);
}
