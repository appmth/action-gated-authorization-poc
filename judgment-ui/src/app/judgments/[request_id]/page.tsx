type Props = {
    params: Promise<{ request_id: string}>;
};

export default async function JudgementPage({ params }: Props){
    const { request_id } = await params;

    return(
        <main className="p-8">
            <h1 className="test-2xl font-bold mb-4">Judgment Detail</h1>
            <p className="text-gray-600">Request ID:{request_id}</p>
            <p className="text-gray-600">詳細がここにひょうじされます（Phase 2 で実装）</p>
        </main>
    )
}