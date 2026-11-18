/// <reference types="vite/client" />

declare namespace GeoJSON {
  export interface Feature<G = any, P = Record<string, any>> {
    type: "Feature";
    id?: string | number;
    geometry: G;
    properties: P;
  }

  export interface FeatureCollection<G = any, P = Record<string, any>> {
    type: "FeatureCollection";
    features: Array<Feature<G, P>>;
  }
}
