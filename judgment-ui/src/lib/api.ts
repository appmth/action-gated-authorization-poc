import { JudgmentDetail, JudgmentSummary } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL

/**
 * Judgment 一覧を取得
 *
 * 学習ポイント: Server Component から直接 fetch できる
 * - クライアントに API キーを露出させない
 * - キャッシュ戦略を細かく制御可能
 */
export async function getJudgments(): Promise<JudgmentSummary[]>{
    const res = await fetch(`${API_URL}/judgments` , {
        cache: 'no-store'
    });

    if(!res.ok){
        throw new Error(`Failed to fetch judgments ${res.status}`)
    }

    return res.json()
}

/**
 * Judgment 詳細を取得
*/
export async function getJudgment(requestId: string): Promise<JudgmentDetail> {
    const res = await fetch(`${API_URL}/judgments/${requestId}`, {
        cache: 'no-store'
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch judgment ${res.status}`)
    }

    return res.json()
}
