declare module "jsqr" {
  export type QRCode = {
    data: string;
  };

  export type QRCodeOptions = {
    inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst";
  };

  const jsQR: (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: QRCodeOptions,
  ) => QRCode | null;

  export default jsQR;
}
