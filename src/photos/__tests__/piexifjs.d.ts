declare module 'piexifjs' {
  const piexif: {
    GPSIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSHelper: { degToDmsRational(deg: number): [number, number][] };
    dump(exif: Record<string, unknown>): string;
    insert(exif: string, jpeg: string): string;
  };
  export default piexif;
}
