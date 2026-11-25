import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  useState(() => { navigate("/login", { replace: true }); });
  return null;
}
