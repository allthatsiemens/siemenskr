const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzPd1YgNmoY3ubuad5IabiivxdWzDc0UHVnlQ1MKoy5XRumd4sqRzK_1Sdgph8myPCLEA/exec';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const buildUpstreamGetUrl = (requestUrl) => {
  const upstreamUrl = new URL(APP_SCRIPT_URL);
  const incomingUrl = new URL(requestUrl);

  incomingUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  if (!upstreamUrl.searchParams.has('action')) {
    upstreamUrl.searchParams.set('action', 'listQuestions');
  }

  return upstreamUrl.toString();
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...jsonHeaders,
      allow: 'GET, POST, OPTIONS'
    }
  });
}

export async function onRequestGet(context) {
  try {
    const upstream = await fetch(buildUpstreamGetUrl(context.request.url), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
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

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();

    const upstream = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=utf-8'
      },
      body
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
