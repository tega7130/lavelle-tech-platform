export async function POST(request: Request) {
    try {
        const body = await request.json();

        console.log("OPay webhook received:", body);

        return Response.json(
            { received: true },
            { status: 200 }
        );
    } catch (error) {
        console.error("OPay webhook error:", error);

        return Response.json(
            { received: false },
            { status: 400 }
        );
    }
}