import { Button, Input, PasswordInput, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import axios from "axios";
import "./../authPage.css";
import { useState } from "react";

type signUpFormValues = {
  prime_id: string;
  email: string;
  password: string;
  rememberMe: boolean;
};

function SignUpForm() {
  const signUpForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      email: "",
      full_name: "",
      password: "",
      password2: "",
    },
    validate: {
      //   full_name: hasLength({ min: 3 }, "Must be at least 3 characters"),
      //   email: isEmail("Invalid email"),
      //   password: hasLength({ min: 8 }, "Minimum 8 characters"),
      //   password2: hasLength({ min: 8 }, "Minimum 8 characters"),
    },
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUpSubmit = async (event: signUpFormValues) => {
    console.log("handleSignUpSubmit=", event);

    //**********Sign Up logic*************

    // try {
    //   const response = await axios.post(
    //     "http://127.0.0.1:8000/api/accounts/signup/",
    //     event,
    //     {
    //       headers: {
    //         "Content-Type": "application/json",
    //         Authorization: `Token 93860001a2b67e87312f20283ee91b7503e3b078`,
    //       },
    //     }
    //   );
    // } catch (error) {
    //   console.error("Error posting data:", error);
    // }
  };
  return (
    <>
      <Text
        size="lg"
        style={{
          fontSize: "16px",
        }}
      >
        Sign up with your credentials
      </Text>
      <form onSubmit={signUpForm.onSubmit(handleSignUpSubmit)}>
        <div className="mantine-floating-wrapper">
          <Input
            component="input"
            placeholder=" "
            size="md"
            required
            {...signUpForm.getInputProps("email")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Email ID <span>*</span>
          </label>
        </div>
        <div className="mantine-floating-wrapper">
          <Input
            component="input"
            placeholder=" "
            size="md"
            required
            {...signUpForm.getInputProps("full_name")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            User Name <span>*</span>
          </label>
        </div>
        <div className="mantine-floating-wrapper">
          <PasswordInput
            placeholder=" "
            size="md"
            required
            {...signUpForm.getInputProps("password")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Password <span>*</span>
          </label>
        </div>
        <div className="mantine-floating-wrapper">
          <PasswordInput
            placeholder=" "
            size="md"
            required
            {...signUpForm.getInputProps("password")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Re-Enter Password <span>*</span>
          </label>
        </div>
        <Button
          type="submit"
          radius={"md"}
          fullWidth
          mt="lg"
          color="#105476"
          size="md"
        style={{display:"flex", alignItems:"center",justifyContent:"center"}}
                >
                  <Text mr="xs">Submit</Text>
                  {isLoading ? <Loader size={20} color="white"/> :<IconCheck size={20} stroke={2} /> }
        </Button>
      </form>
    </>
  );
}

export default SignUpForm;
