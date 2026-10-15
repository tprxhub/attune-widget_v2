export const IMAGE_DIMENSIONS = {
  logo: "1024 × 670 px · transparent PNG recommended",
  hero: "2400 × 1600 px · landscape (3:2)",
  phone: "1080 × 1920 px · portrait (9:16)",
  auth: "1024 × 1408 px · portrait (8:11)",
  journey: "1200 × 800 px · landscape (3:2)",
  week: "2400 × 1200 px · landscape (2:1)",
  thumbnail: "1280 × 720 px · landscape (16:9)",
  avatar: "512 × 512 px · square (1:1)",
} as const;

const USES = [
  ["Application logo", IMAGE_DIMENSIONS.logo, "5 MB"],
  ["Homepage background", IMAGE_DIMENSIONS.hero, "10 MB"],
  ["Phone wallpaper", IMAGE_DIMENSIONS.phone, "10 MB"],
  ["Login and signup photographs", IMAGE_DIMENSIONS.auth, "10 MB"],
  ["Journey card photographs", IMAGE_DIMENSIONS.journey, "10 MB"],
  ["Play Plan week banner", IMAGE_DIMENSIONS.week, "10 MB"],
  ["Play Dose card thumbnails", IMAGE_DIMENSIONS.thumbnail, "—"],
  ["Account profile photographs", IMAGE_DIMENSIONS.avatar, "5 MB"],
];

export function ImageDimensionsGuide() {
  return (
    <section className="ph-card min-w-0 p-5" aria-labelledby="image-dimensions-heading">
      <h2 id="image-dimensions-heading" className="text-lg font-bold">
        Image dimensions
      </h2>
      <p className="mt-1 text-sm text-navy/65">
        Recommended width × height in pixels. Other sizes are accepted; photographs crop to fit
        their space. Keep faces and important details away from the edges. Upload JPG, PNG or WebP.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-navy/15">
              <th className="py-2 pr-4">Image</th>
              <th className="py-2 pr-4">Recommended dimensions</th>
              <th className="py-2">Maximum file size</th>
            </tr>
          </thead>
          <tbody>
            {USES.map(([label, size, limit]) => (
              <tr key={label} className="border-b border-navy/8">
                <th scope="row" className="py-3 pr-4 font-semibold">
                  {label}
                </th>
                <td className="py-3 pr-4">{size}</td>
                <td className="py-3">{limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
