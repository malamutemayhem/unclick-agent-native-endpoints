import FadeIn from "./FadeIn";

const Strip = () => {
  const text = "No browser. No clicks. No workarounds. Just endpoints.";
  const repeated = `${text}  ·  ${text}  ·  ${text}  ·  ${text}  ·  `;
  
  return (
    <FadeIn>
      <section className="border-y border-border overflow-hidden py-6">
        <div className="animate-marquee whitespace-nowrap flex">
          <span className="font-mono text-sm font-medium tracking-wider text-primary px-2">
            {repeated}
          </span>
          <span className="font-mono text-sm font-medium tracking-wider text-primary px-2">
            {repeated}
          </span>
        </div>
      </section>
    </FadeIn>
  );
};

export default Strip;
