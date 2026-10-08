/**
 * Web Serial and WebUSB are not part of TypeScript's bundled lib.dom, but
 * Chrome and Edge expose them on navigator. Declared here so typed code can
 * use them without `any` casts; members are intentionally permissive because
 * this is a browser API bridge, not application logic.
 *
 * eslint-disable @typescript-eslint/no-explicit-any -- see comment above
 */

interface SerialPort {
  [key: string]: any;
}

interface Serial {
  [key: string]: any;
}

interface USBDevice {
  [key: string]: any;
}

interface USB {
  [key: string]: any;
}

interface Navigator {
  serial?: Serial;
  usb?: USB;
}
