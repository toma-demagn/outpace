export const STATIC_DEMO_TOKEN = "static-demo";

export async function getStaticDemo() {
  const response = await fetch(`${process.env.PUBLIC_URL}/demo-data.json`);
  if (!response.ok) {
    throw new Error(`Could not load static demo data (${response.status})`);
  }
  return response.json();
}
