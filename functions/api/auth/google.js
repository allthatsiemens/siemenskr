const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzPd1YgNmoY3ubuad5IabiivxdWzDc0UHVnlQ1MKoy5XRumd4sqRzK_1Sdgph8myPCLEA/exec';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...jsonHeaders,
      allow: 'POST, OPTIONS'
    }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    if (!body?.idToken) {
      return new Response(JSON.stringify({ ok: false, error: 'idToken is required' }), {
        status: 400,
        headers: jsonHeaders
      });
    }

    const upstream = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ idToken: body.idToken })
    });

    const text = await upstream.text();

    return new Response(text, {
      status: upstream.ok ? 200 : upstream.status,
      headers: jsonHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Unknown error' }), {
      status: 500,
      headers: jsonHeaders
    });
  }
}
