import App from "@/src/components/menuPage/mainApp";

type Props = {
  params: Promise<{ tableId: string }>;
};

export default async function TablePage({ params }: Props) {
  const { tableId } = await params;
  return <App tableId={tableId} />;
}
