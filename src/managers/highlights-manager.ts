import browser from '../utils/browser-polyfill';
import { detectBrowser } from '../utils/browser-detection';
import { AnyHighlightData } from '../utils/highlighter';
import dayjs from 'dayjs';
import { getMessage } from '../utils/i18n';

export async function exportHighlights(): Promise<void> {
	try {
		const result = await browser.storage.local.get('highlights');
		const allHighlights = result.highlights || {};

		const exportData = Object.entries(allHighlights).map(([url, data]) => ({
			url,
			highlights: data.highlights as AnyHighlightData[]
		}));

		const jsonContent = JSON.stringify(exportData, null, 2);
		const blob = new Blob([jsonContent], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const browserType = await detectBrowser();
		const timestamp = dayjs().format('YYYYMMDDHHmm');
		const fileName = `obsidian-web-clipper-highlights-${timestamp}.json`;

		if (browserType === 'safari' || browserType === 'mobile-safari') {
			if (navigator.share) {
				try {
					await navigator.share({
						files: [new File([blob], fileName, { type: 'application/json' })],
						title: 'Exported Obsidian Web Clipper Highlights',
						text: 'Here are your exported highlights from Obsidian Web Clipper.'
					});
				} catch (error) {
					console.error('Error sharing:', error);
					window.open(url);
				}
			} else {
				window.open(url);
			}
		} else {
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}

		URL.revokeObjectURL(url);
	} catch (error) {
		console.error('Error exporting highlights:', error);
		alert(getMessage('failedToExportHighlights'));
	}
}

export async function importHighlights(jsonContent: string): Promise<void> {
	try {
		const importedData = JSON.parse(jsonContent);
		if (!Array.isArray(importedData)) {
			throw new Error('Invalid format: root must be an array');
		}

		const result = await browser.storage.local.get('highlights');
		const allHighlights: Record<string, any> = result.highlights || {};
		let importCount = 0;

		for (const item of importedData) {
			if (!item.url || !Array.isArray(item.highlights)) continue;

			const existing = allHighlights[item.url] || { url: item.url, highlights: [] };
			const existingIds = new Set(existing.highlights.map((h: any) => h.id));
			
			for (const h of item.highlights) {
				if (!h.id || !h.xpath || !h.type) continue; 
				
				if (!existingIds.has(h.id)) {
					existing.highlights.push(h);
					existingIds.add(h.id);
					importCount++;
				}
			}
			
			if (existing.highlights.length > 0) {
				allHighlights[item.url] = existing;
			}
		}

		await browser.storage.local.set({ highlights: allHighlights });
		alert(getMessage('importSuccess') + ` (${importCount})`);
	} catch (error) {
		console.error('Error importing highlights:', error);
		alert(getMessage('importFailed'));
	}
}
