export default function About({setAbout}: {setAbout: (val: boolean) => void}) {
    return (
        <div className="confirm about" onClick={() => setAbout(false)}>
            <p className="info-title">
                <b>neighborhoods.na</b> is a <a href="https://en.wikipedia.org/wiki/Directed_graph">directed graph</a> of <b><a href="https://are.na">are.na</a></b>.
            </p>
            <p className="info-text">
                <a href="https://are.na">are.na</a> is a content aggregation website made up of "blocks" and "channels". Blocks contain files uploaded by users,
                while channels are collections of those blocks (and may also contain channels themselves).
                The relationship between blocks and channels is unidrectional, but the relationship between channels and other channels is bidrectional. 
                With these rules in mind, neighborhoods.na uses <a href="https://en.wikipedia.org/wiki/Adjacency_list">adjacency lists</a> to construct directed graphs based on the relationship between blocks and channels.
            </p>
            <p className="info-text">
                Click the canvas to add a node. Click a node to see its parents and children.
            </p>
            <div className="examples">
                <div className="example-box box solid">Selected</div>
                <div className="info-title">→</div>
                <div className="example-box box dotted">Adjacent</div>
                <div className="info-title">→</div>
                <div className="example-box box">Unselected</div>
            </div>
            <p className="info-text">
                See also:
            </p>
        </div>
    )
}