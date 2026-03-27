export const Tab = ({
  title,
  isActive,
  ref,
  ...rest
}: {
  title: string;
  isActive?: boolean;
  ref: (node: HTMLElement | null) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  let className = "h-full flex items-center justify-center w-full";
  if (isActive) {
    className = className + " " + "border-b-2 border-red-400";
  }
  return (
    <li
      ref={ref}
      className={`h-full w-75 flex items-center whitespace-nowrap text-gray-700 hover:text-blue-600 cursor-pointer font-medium transition-colors grow shrink-0 `}
    >
      <button className={className} {...rest}>
        {title}
      </button>
    </li>
  );
};
