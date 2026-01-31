export default function TopBar() {
    return (
        <header className="h-16 bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-10 flex items-center px-6 justify-between">
            <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-900">Judgment</span>
                <span className="text-gray-400">▸</span>
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    Project: gov-demo
                </span>
            </div>

            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">user ◯</span>
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            </div>
        </header>
    );
}
