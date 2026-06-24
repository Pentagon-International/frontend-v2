import { Badge } from "@mantine/core";
import {
  getOdexStatusColor,
  getOdexStatusLabel,
} from "../odexConstants";

type Props = {
  status: string;
};

export default function OdexStatusBadge({ status }: Props) {
  const color = getOdexStatusColor(status);
  return (
    <Badge bg={color} color="white" variant="filled" radius="xl" size="sm" px={8} py={4}>
      {getOdexStatusLabel(status)}
    </Badge>
  );
}
