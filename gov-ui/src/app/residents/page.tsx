export default function ResidentsPage() {
  const residentData = {
    basic: {
      name: "山田 太郎",
      address: "○○市○○町1-2-3",
      household: "3人（本人、配偶者、子1人）",
      birthdate: "1985年4月15日",
    },
    sensitive: {
      taxStatus: "完納",
      welfareUse: "介護保険利用中",
      medicalAid: "対象外",
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          住民データ閲覧
        </h2>
        <p className="text-gray-600">
          住民基本情報およびセンシティブ情報の一覧
        </p>
      </div>

      {/* 警告文 */}
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-red-500 text-xl">⚠</div>
          <div>
            <p className="text-red-700 font-medium">注意</p>
            <p className="text-red-600 text-sm mt-1">
              本画面に表示されている情報は、「ゴミ収集日の問い合わせ」には不要な個人情報を含みます。
            </p>
          </div>
        </div>
      </div>

      {/* 住民基本情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          住民基本情報
        </h3>
        <table className="w-full">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-3 text-sm text-gray-500 w-1/3">氏名</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.basic.name}
              </td>
            </tr>
            <tr>
              <td className="py-3 text-sm text-gray-500">住所</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.basic.address}
              </td>
            </tr>
            <tr>
              <td className="py-3 text-sm text-gray-500">世帯構成</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.basic.household}
              </td>
            </tr>
            <tr>
              <td className="py-3 text-sm text-gray-500">生年月日</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.basic.birthdate}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* センシティブ情報 */}
      <div className="bg-white rounded-lg border-2 border-red-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-medium text-red-700">
            センシティブ情報
          </h3>
          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">
            要注意
          </span>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-red-100">
            <tr>
              <td className="py-3 text-sm text-gray-500 w-1/3">納税状況</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.sensitive.taxStatus}
              </td>
            </tr>
            <tr>
              <td className="py-3 text-sm text-gray-500">福祉利用</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.sensitive.welfareUse}
              </td>
            </tr>
            <tr>
              <td className="py-3 text-sm text-gray-500">医療補助</td>
              <td className="py-3 text-sm text-gray-900">
                {residentData.sensitive.medicalAid}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 補足説明 */}
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600 text-sm">
          この画面は、AI Agent が問い合わせ対応時にアクセス可能なデータを示しています。
          <br />
          Judgment（認可制御）がない場合、これらの情報に無制限にアクセスできてしまいます。
        </p>
      </div>
    </div>
  );
}
