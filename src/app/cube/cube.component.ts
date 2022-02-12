import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { MatSliderChange } from '@angular/material/slider';
import * as THREE from 'three';
import { PlaneGeometry } from 'three';

@Component({
  selector: 'app-cube',
  templateUrl: './cube.component.html',
  styleUrls: ['./cube.component.css']
})
export class CubeComponent implements OnInit, AfterViewInit {
  ngAfterViewInit() {
    this.createScene();
    this.startRenderingLoop();
  }

  @ViewChild('canvas')
  private canvasRef!: ElementRef;

  ngOnInit(): void {
  }

  private camera!: THREE.PerspectiveCamera;

  private get canvas() {
    return this.canvasRef.nativeElement;
  }

  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private material = new THREE.MeshPhongMaterial({ color: 0xff00ff });
  private orangeMaterial = new THREE.MeshPhongMaterial({ color: 0xff8000 });
  private refractMaterial = new THREE.MeshPhysicalMaterial({
    roughness: 0.3,
    transmission: 1,
    // ior: 2.3,
    // reflectivity: 0.1,
    color: 0xff0000,

  });

  private cube: THREE.Mesh = new THREE.Mesh(this.geometry, this.material);

  private ringMesh!: THREE.Mesh;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;

  @Input() public radialSubdivisions = 30;
  @Input() public depth = 2;
  @Input() public numSamples = 5;
  @Input() public innerRadius = 2;
  @Input() public thickness = 0.3;
  @Input() public curvatureMagnitute = 0.2;

  private createScene(): void {
    this.refractMaterial.thickness = 1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf000000);
    // this.scene.add(this.cube);

    const planeTexture = new THREE.TextureLoader().load("assets/texture.jpg");
    const planeMaterial = new THREE.MeshBasicMaterial({ map: planeTexture });
    const planeMaterial2 = new THREE.MeshPhongMaterial({ color: 0x000000 });

    const plane = new PlaneGeometry(8, 8);
    const planeMesh = new THREE.Mesh(plane, planeMaterial);
    planeMesh.position.z = -4;
    // this.scene.add(planeMesh)

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 5, 10).normalize();
    this.scene.add(light);

    const deco = new THREE.DodecahedronGeometry(0.4, 1);
    deco.scale(1.5, 1, 1)
    deco.computeVertexNormals();
    const decoMesh = new THREE.Mesh(deco, this.material);

    // this.scene.add(decoMesh);

    let aspectRatio = this.getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(
      1,
      aspectRatio,
      1,
      1000
    );

    this.camera.position.z = 400;
  }

  private createRing(): THREE.BufferGeometry {
    const curvatureSamples = [];
    curvatureSamples.push(new THREE.Vector2(-this.depth / 2, this.innerRadius));

    for (let i = 0; i < this.numSamples; i++) {
      const x = interpolate(i, 0, this.numSamples - 1, -1, 1);
      curvatureSamples.push(new THREE.Vector2(
        x * (this.depth / 2),
        this.thickness + this.innerRadius + quadraticCurvature(x, this.curvatureMagnitute),
      ));
    }

    // curvatureSamples.push(new THREE.Vector2(-this.depth / 2 + this.curvatureMagnitute, this.innerRadius + this.thickness));
    // curvatureSamples.push(new THREE.Vector2(this.depth / 2 - this.curvatureMagnitute, this.innerRadius + this.thickness));

    curvatureSamples.push(new THREE.Vector2(this.depth / 2, this.innerRadius));
    curvatureSamples.push(new THREE.Vector2(-this.depth / 2, this.innerRadius));

    const verts = this.makeRingMeshVerts(curvatureSamples, this.radialSubdivisions);

    const vertices = new Float32Array(verts);
    const ringGeometry = new THREE.BufferGeometry();
    ringGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    ringGeometry.computeVertexNormals();

    return ringGeometry;
  }

  private getAspectRatio(): number {
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }

  private animateCube(): void {
    if (this.ringMesh) {
      this.ringMesh.rotation.y += 0.01;
      // this.ringMesh.rotation.y = Math.PI / 5;
      this.ringMesh.rotation.x = -Math.PI / 16;
    }
  }

  private startRenderingLoop(): void {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    let component: CubeComponent = this;
    (function render() {
      requestAnimationFrame(render);
      component.animateCube();
      component.renderer.render(component.scene, component.camera);
    }());
  }

  private makeRingMeshVerts(curvatureSamples: THREE.Vector2[], radialSubdivisions: number): number[] {
    const verts = [];
    const anglePerSubdivision = 2 * Math.PI / radialSubdivisions;
    for (let radialIndex = 0; radialIndex < radialSubdivisions; radialIndex++) {
      const angle = radialIndex * anglePerSubdivision;
      const angleNext = (radialIndex + 1) * anglePerSubdivision;
      for (let sampleIndex = 0; sampleIndex < curvatureSamples.length - 1; sampleIndex++) {
        const currentSample = curvatureSamples[sampleIndex];
        const nextSample = curvatureSamples[sampleIndex + 1];
        const a = polarToCartesian(currentSample.y, angle);
        const b = polarToCartesian(nextSample.y, angle);
        const c = polarToCartesian(nextSample.y, angleNext);
        const d = polarToCartesian(currentSample.y, angleNext);

        function addZ(p: THREE.Vector2, z: number) {
          return new THREE.Vector3(p.x, p.y, z);
        }

        verts.push(...quadVerts(
          addZ(a, currentSample.x),
          addZ(b, nextSample.x),
          addZ(c, nextSample.x),
          addZ(d, currentSample.x)
        ));
      }
    }
    return verts;
  }

  public onRadialSubdivisionsSlider(event: MatSliderChange): void {
    this.radialSubdivisions = event.value!;
    this.recreateRing();
  }
  public onDepthSlider(event: MatSliderChange): void {
    this.depth = event.value!;
    this.recreateRing();
  }
  public onNumSamplesSlider(event: MatSliderChange): void {
    this.numSamples = event.value!;
    this.recreateRing();
  }
  public onInnerRadiusSlider(event: MatSliderChange): void {
    this.innerRadius = event.value!;
    this.recreateRing();
  }
  public onThicknessSlider(event: MatSliderChange): void {
    this.thickness = event.value!;
    this.recreateRing();
  }
  public onCurvatureMagnitudeSlider(event: MatSliderChange): void {
    this.curvatureMagnitute = event.value!;
    this.recreateRing();
  }


  private recreateRing(): void {
    let angle = 0;
    if (this.ringMesh) {
      angle = this.ringMesh.rotation.y;
      this.scene.remove(this.ringMesh);
    }
    this.ringMesh = new THREE.Mesh(this.createRing(), this.orangeMaterial);
    this.ringMesh.rotation.y = angle;
    this.scene.add(this.ringMesh);
  }
}

function quadraticCurvature(x: number, curveMagnitude: number): number {
  return -curveMagnitude * x * x + curveMagnitude;
}
function polarToCartesian(radius: number, angle: number): THREE.Vector2 {
  return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
}

function quadVerts(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): number[] {
  return [a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, d.x, d.y, d.z];
}

function interpolate(n: number, start1: number, stop1: number, start2: number, stop2: number): number {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
};

// function addSlit(curvatureSamples: THREE.Vector2[], x1: number, x2: number, slitDepth: number) {
//   const startIndex = curvatureSamples.findIndex(p => x1 > p.x);
//   const endIndex = findLastIndex(curvatureSamples, p => x2 < p.x);
//   const a = [
//     ...curvatureSamples.slice(0, startIndex),
//     new THREE.Vector2(curvatureSamples[startIndex].x, slitDepth),
//     new THREE.Vector2(curvatureSamples[endIndex].x, slitDepth),
//     ...curvatureSamples.slice(endIndex)
//   ]
//   return a;
// }

// function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
//   let l = array.length;
//   while (l--) {
//     if (predicate(array[l], l, array)) return l;
//   }
//   return -1;
// }

function makeGemGeometry(sheets: THREE.Vector3[][]) {
  for(let i = 0; i < sheets.length - 1; i++) {
    const currentSheet = sheets[i];
    const nextSheet = sheets[i + 1];
  }

}

function makeFlatSurfaceFromOutline(points: THREE.Vector3[]) {
  const center = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    center.add(points[i])
  }
  center.divideScalar(points.length);

  const verts = [];
  for (let i = 0; i < points.length; i++) {
    verts.push(
      ...pointsFromVec(points[i]),
      ...pointsFromVec(center),
      ...pointsFromVec(points[(i + 1) % points.length])
    );
  }
}

function pointsFromVec(point: THREE.Vector3) {
  return [point.x, point.y, point.z];
}

function gcd(p: number, q: number): number {
  if (q == 0) return p;
  else return gcd(q, p % q);
}