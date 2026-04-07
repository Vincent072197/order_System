export async function GET() {
  return Response.json({ message: "Hello" });
}

export async function POST(request: Request) {
  const body = await request.json();
  console.log("Order received:", body); // show up on terminal
  return Response.json({ message: "order recieved" });
}
