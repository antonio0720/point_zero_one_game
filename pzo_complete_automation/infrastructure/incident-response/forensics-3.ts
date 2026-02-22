import * as pcapjs from 'pcap-parser';

interface Packet {
timestamp: number;
src: string;
dst: string;
protocol: string;
}

class Forensics {
private pcaptools: pcapjs.PCAPTools;

constructor(filePath: string) {
this.pcaptools = new pcapjs.PCAPTools(filePath);
}

public async analyze(): Promise<Packet[]> {
const packets: Packet[] = [];

for await (const header of this.pcaptools.readHeaders()) {
for await (const packetData of this.pcaptools.readNext(header)) {
const src = this.pcaptools.ipInHeader(packetData, header.linktype).src;
const dst = this.pcaptools.ipInHeader(packetData, header.linktype).dst;
const protocol = this.pcaptools.protocol(packetData, header);

packets.push({
timestamp: header.timestamp,
src,
dst,
protocol: protocol?.name || '',
});
}
}

return packets;
}
}
