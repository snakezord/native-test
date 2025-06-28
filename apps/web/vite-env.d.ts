/// <reference types="vite/client" />

import { extend } from "@react-three/fiber";
import {
  ShaderMaterial,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  Points,
  AmbientLight,
} from "three";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      shaderMaterial: any;
      bufferGeometry: any;
      bufferAttribute: any;
      mesh: any;
      points: any;
      ambientLight: any;
      simulationMaterial: any;
    }
  }
}
