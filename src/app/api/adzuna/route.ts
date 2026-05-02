import axios from 'axios';

export async function GET() {
  console.log('Adzuna API called');
  try {
    const response = await axios.get(
      'https://api.adzuna.com/v1/api/jobs/gb/categories?app_id=5a7ab68f&app_key=ebfbacb05bf0f9222318228215d0ee6e'
    );
    return Response.json({ success: true, data: response.data });
  } catch (err: any) {
    const message =
      err?.response?.data?.message ?? err?.message ?? 'Adzuna request failed';
    const status = err?.response?.status ?? 502;
    return Response.json({ success: false, error: message }, { status });
  }
}