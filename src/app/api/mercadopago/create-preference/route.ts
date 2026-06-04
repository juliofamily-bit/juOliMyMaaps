import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken, items, external_reference, back_urls } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items,
        external_reference: external_reference,
        back_urls: back_urls,
        auto_return: 'approved'
      }
    });

    return NextResponse.json({
      id: result.id,
      init_point: result.init_point
    });

  } catch (error: any) {
    console.error("Error creating Mercado Pago preference:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
