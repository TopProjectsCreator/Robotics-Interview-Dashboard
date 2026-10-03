declare module "occt-import-js" {
  export interface OcctMesh {
    name?: string;
    color?: number[];
    brep_faces?: { first: number; last: number; color?: number[] | null }[];
    attributes: {
      position: { array: number[] };
      normal?: { array: number[] };
    };
    index: { array: number[] };
  }

  export interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
    root?: { name?: string; meshes?: number[]; children?: unknown[] };
  }

  export interface OcctReader {
    ReadStepFile: (bytes: Uint8Array, params: null) => OcctResult;
    ReadIgesFile: (bytes: Uint8Array, params: null) => OcctResult;
    ReadBrepFile: (bytes: Uint8Array, params: null) => OcctResult;
  }

  export interface OcctModuleOptions {
    /** Emscripten hook: map a requested filename (e.g. the .wasm) to a real URL. */
    locateFile?: (file: string, prefix: string) => string;
  }

  export default function occtimportjs(options?: OcctModuleOptions): Promise<OcctReader>;
}
