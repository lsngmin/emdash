import { useState } from "react";

import { BlockRenderer } from "../renderer.js";
import type { BlockInteraction, TabBlock } from "../types.js";

export function TabBlockComponent({
	block,
	onAction,
}: {
	block: TabBlock;
	onAction: (interaction: BlockInteraction) => void;
}) {
	const [activeTab, setActiveTab] = useState(block.default_tab ?? 0);

	return (
		<div>
			<div className="flex border-b border-border">
				{block.panels.map((panel, i) => (
					<button
						key={i}
						onClick={() => setActiveTab(i)}
						className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
							activeTab === i
								? "border-kumo-link text-kumo-link"
								: "border-transparent text-kumo-subtle hover:text-kumo-default"
						}`}
					>
						{panel.label}
					</button>
				))}
			</div>
			<div className="pt-4">
				<BlockRenderer blocks={block.panels[activeTab]?.blocks ?? []} onAction={onAction} />
			</div>
		</div>
	);
}
